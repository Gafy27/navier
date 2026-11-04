---
name: fast-tokio
description: >
  MUST load when designing or writing Tokio / async Rust that touches the
  runtime (spawn, select, Mutex, spawn_blocking, multi-runtime, fairness,
  latency). Principles for fast Tokio applications from dial9: measure first,
  split for latency / batch for throughput, avoid global-resource and mutex
  stalls, constrain parallelism, isolate workers. Trigger: tokio, async fn,
  spawn, spawn_blocking, runtime, JoinSet, Semaphore, schedule latency,
  long poll, work stealing — any design or code that uses Tokio.
---

# Fast Tokio

**First action** when design or code uses Tokio: read this skill, then apply
the checklist below. Do not optimize from vibes.

Source (living doc): [Principles for fast Tokio applications](https://dial9-rs.github.io/blog/principles-for-fast-tokio-applications/)
(Russell / dial9, 2026-09-13). Distill and apply; do not paste the post.

Idioms and channel/`select!` patterns stay in
[`rust-async-patterns`](../rust-async-patterns/SKILL.md). This skill is
**runtime performance and fairness**.

## When to use

- Designing async crates, services, or task graphs on Tokio
- Writing/reviewing `async` code that spawns, blocks, locks, or fans out
- Debugging latency, unfairness, or “Tokio is slow” reports
- Choosing `spawn` vs inline work, `spawn_blocking`, semaphores, or extra runtimes

## When not to use

- Pure sync Rust with no Tokio
- Binding-spec process / tickets (use `design-docs`) unless the design’s
  runtime shape is the open question

## Measure first

1. Name the **user-facing or product metric** (P99, drain time, apply lag).
   Do not “fix” long polls that do not move that metric.
2. Alice Ryhl’s **10–100 µs** poll guideline is a smell, not a law. Almost
   every real app exceeds it; many of those polls are benign.
3. Prefer **schedule latency** (ready → first poll) as the Tokio symptom.
   It does not name the cause. Long polls alone are not a bug.
4. Most production pain is **application / distributed interaction**, not
   the scheduler. Traces (dial9 / tokio-metrics) often show the *lack* of
   a Tokio problem — search elsewhere then.

## Split for latency, batch for throughput

| Goal | Action |
|------|--------|
| Fairness / low latency across peers | Yield more often (`yield_now`, or after N consecutive immediately-ready reads) |
| Throughput / amortized overhead | Batch work into larger units per poll / per blocking segment |

- Pipelined readers that keep getting `Poll::Ready` starve other connections.
  Throughput is often unchanged; **latency** is not. Yield after each unit,
  or after a small ready streak (post example: four consecutive ready reads).
- Without `io_uring`, `tokio::fs` runs **each** call on the blocking pool.
  Treat a tight loop of `tokio::fs` as harmful. Batch into the largest
  sensible blocking segment; a dedicated OS thread can be a better fit.
- Batch also when you know work will hit the **global queue**.
- Do not spawn micro-tasks (~10 µs of work each). Hundreds/thousands of
  tiny tasks add schedule delay and poll overhead.

**This problem looks like:** P99 ≫ P50; a poll lasts longer than the work
inside it; many spans sit in one poll; `spawn_blocking` / `tokio::fs` show
in flamegraphs; throughput rises when the same work is grouped.

## Global resources and mutexes

- The **blocking pool** is a shared resource (sharded queue exists only as
  an unstable, off-by-default Tokio feature). High `spawn_blocking` rates
  contend on it (post ballpark: ~50k blocking tasks/s on a 32-core host).
- `spawn_blocking` is not a default for CPU-heavy or blocking work. Short,
  bounded work can be faster left on Tokio workers + stealing.
- The **global task queue** fills when a local queue overflows (rare) or
  when work is scheduled from **outside** a runtime worker (common: channel
  send from a non-Tokio thread). Healthy: near empty. Saturated: slow to drain.
- Never hold a sync `Mutex`/`RwLock` across expensive work, I/O, flush, or
  `.await`. Critical section = one map update, not a flush. A metrics
  registry behind a lock that flushes while held can stall **every**
  worker; stealing then cannot help.
- `RWLock` is almost never the right hot-path primitive (atomic contention
  on the read path too).
- `tokio::sync::Mutex` is expensive to lock and can **FutureLock**. Use it
  only when the critical section is multi-millisecond **async** work.

**This problem looks like:** `spawn_blocking` prominent in flamegraphs;
global queue stays deep; P99 spikes on a timer (background flush);
dial9 shows many tasks blocked off-CPU together.

## Parallelism and isolation

- Bound fan-out with a `Semaphore` (or equivalent). Unbounded spawn →
  unbounded downstream connections.
- Tokio needs workers to wake **quickly**. Under OS load, unpark → run can
  take **10–20 ms+** — fatal for single-digit-ms P99. Pin Tokio workers
  away from other processes/threads (`cgroups` / affinity).
- Pin noisy background threads (e.g. `tracing_appender` doing 100 ms of
  CPU) off Tokio cores. **Rarely give Tokio every core**; reserving cores
  for other work usually improves latency.

**This problem looks like:** kernel delay between worker-unpark and the
worker actually running.

## Tricks only when you know better

Default: **do not** reach for these.

| Trick | When it can be right |
|-------|----------------------|
| Long polls / batch on a worker | Light load + spare steal capacity. Breaks when the runtime is loaded (no spare workers) **or** the OS delays unpark — I/O driving then starves. **Never** inside `join!`/`select!` (no steal inside one task) |
| Multiple runtimes + core pin / `on_thread_start` niceness | Latency-critical path vs background work need a hard scheduling boundary |
| Spin ~**50 µs** instead of yield | Microsecond-class latency under controlled cores; burns a core; wrong for most apps |

## Design / review checklist

```
- [ ] Product metric named; not enforcing 10–100 µs polls blindly
- [ ] Fairness: ready-loops yield (or batch a streak, then yield)
- [ ] Batching: no tiny spawn / tiny tokio::fs / spawn_blocking storms
- [ ] Short CPU work considered for workers, not default spawn_blocking
- [ ] No sync lock held across await / I/O / flush (watch FutureLock)
- [ ] Fan-out bounded (Semaphore or fixed pool)
- [ ] Global queue / non-Tokio threads considered
- [ ] Isolation: noisy threads/processes off Tokio cores; not every core
- [ ] Long poll / extra runtime / 50 µs spin only with an explicit justification
```

## Mental model (four points)

1. Futures advance only between `.await` points (**polls**).
2. Idle futures wait; a good executor polls only when there is work to do.
3. Tokio: **N workers**, local queues; overflow / off-worker schedule →
   **global queue**.
4. Imbalance → another worker may **steal** — if it has capacity and
   wakes in time.

## Cosmos notes

- Process shell: one multi-thread runtime in `cosmos-rt::run_process`. Extra
  runtimes are an explicit product decision, not a casual add.
- Use traces to **see** whether Tokio is the problem; fix yield / batch /
  bound / isolate in application code. If instrumenting, attach at the
  `run_process` builder — do not replace the signal/panic exit shell with
  `#[dial9::main]` casually.
