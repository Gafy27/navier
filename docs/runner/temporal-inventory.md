# Temporal inventory and what the machinery around it is for

Pin: Navier `src` zip 2026-11-04. Cites are `navier/<path>:<first>-<last>`, where `navier/<path>` is `src/<path>` of the pin (`navier/runtime/start.ts` is `src/runtime/start.ts`).
Specs: [P0.2](../../phases/phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md) (D1–D4), [program](../../phases/phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md) (PD1).
Read by P1.3 (Temporal freeze) and P7.4 (dead code). This doc gives no verdicts; verdicts live in P0.4. DBOS mapping lives in P0.3.

## Temporal features in use (D1)

| # | Feature | Where | Used for |
|---|---------|-------|----------|
| T1 | Durable workflow + activity retry | `navier/runtime/workflow.ts:25-37`, `navier/runtime/activities.ts:75-103` | turn survives worker loss; `unavailable`/`aborted` retry, `parseArgs` non-retryable |
| T2 | Signals | `navier/runtime/workflow.ts:20-22` | cancel, graceful_stop, interrupt |
| T3 | Cancellation scopes | `navier/runtime/turn-loop.ts:21-38`, `navier/runtime/turn-loop.ts:192-228` | abort in-flight activity; non-cancellable pause/finish |
| T4 | continue-as-new | `navier/runtime/turn-loop.ts:79-87`, `navier/runtime/turn-loop.ts:162-165` | bound history length (`MAX_HISTORY_LENGTH`, `navier/config.ts:11-18`) |
| T5 | Workflow id conflict/reuse | `navier/runtime/start.ts:42-69` | one running workflow per message; restart after pause |
| T6 | Search attribute OrgId | `navier/temporal/attributes.ts:1-16`, `navier/runtime/start.ts:61-68` | stamped at start; no workflow list filtered by OrgId in `navier/` |
| T7 | Schedules | `navier/runtime/schedule.ts:19-56`, `navier/runtime/stream-sweep.ts:57-95` | reaper, stream sweep |
| T8 | Interceptors + trace header | `navier/temporal/trace.ts:18-74`, `navier/temporal/workflow-interceptors.ts:12-42` | trace id across client/workflow/activity |
| T9 | Activity attempt | `navier/temporal/trace.ts:58-74`, `navier/runtime/tool-call.ts:440-467` | detect an interrupted tool call |
| T10 | Replay tests | `navier/temporal/replay.ts:13-45`, `navier/temporal/replay.test.ts:1-33` | determinism of workflow code |
| T11 | Health probe | `navier/temporal/probe.ts:8-37` | readiness |
| T12 | Worker bootstrap | `navier/temporal/worker.ts:50-92`, `navier/worker.ts:119-199` | task queue, activities, schedules |
| T13 | Client handle / result | `navier/temporal/client.ts:14-33`, `navier/runtime/start.ts:83-112`, `navier/runtime/reaper.ts:229-246`, `navier/runtime/stop.ts:38-55`, `navier/sdk/turn.ts:135-145`, `navier/sdk/turn.ts:180-225`, `navier/runtime/reaper.ts:161-174` | start, signal, `awaitTurn`, and whether an execution is running |

## Direct @temporalio importers

Seventeen files import `@temporalio/*` directly (`navier/sdk/tool.test.ts` only names the package in a string and is not an importer).

- `navier/temporal/workflow-interceptors.ts`
- `navier/temporal/trace.ts`
- `navier/temporal/replay.ts`
- `navier/temporal/worker.ts`
- `navier/temporal/client.ts`
- `navier/temporal/probe.ts`
- `navier/temporal/attributes.ts`
- `navier/runtime/schedule.ts`
- `navier/runtime/decide.ts`
- `navier/runtime/stop.ts`
- `navier/runtime/start.ts`
- `navier/runtime/reaper.ts`
- `navier/runtime/turn-loop.ts`
- `navier/runtime/workflow.ts`
- `navier/runtime/stream-sweep.ts`
- `navier/runtime/activities.ts`
- `navier/sdk/turn.ts`

## What the surrounding machinery is for (D2)

Each piece covers a gap in how Navier uses Temporal.

| # | Machinery | Where | Cause |
|---|-----------|-------|-------|
| M1 | Reaper restart of stale turns | `navier/runtime/reaper.ts:69-96`, `navier/runtime/reaper.ts:272-306` | the start is not atomic with the rows (start after commit, `navier/runtime/start.ts:83-112`); a workflow can end without closing its message |
| M2 | `recovery` table + `maxRecoveries` | `navier/runtime/reaper.ts:107-138`, `navier/runtime/reaper.ts:194-226`, `navier/agents/limits.ts:13-28` | cap reaper restarts per message (append-only audit) |
| M3 | Reaper pause-expiry pass | `navier/runtime/reaper.ts:388-512` | a paused turn has no workflow to time it out |
| M4 | `step_claim` | `navier/runtime/model-step.ts:210-249`, `navier/runtime/migrations/04_0010_step_claim.ts:1-18` | a retried or duplicated activity must not call the model twice for one step |
| M5 | `stop_requested` row | `navier/runtime/stop.ts:64-140` | a stop must survive states with no running workflow (paused, not yet started) |
| M6 | decide restart | `navier/runtime/decide.ts:514-533` | pause ended the workflow |
| M7 | `START_GRACE_MS` grace window | `navier/config.ts:11-18`, `navier/runtime/reaper.ts:69-96`, `navier/runtime/reaper.ts:341-344` | the reaper must not race a start that is still in flight |
| M8 | Pending graceful signal | `navier/runtime/start.ts:130-179` | a running turn must yield to a queued user message |

## Not relied on (D3)

Navier never reads workflow history as state. It never uses queries, updates, child workflows or local activities. A turn's truth is rows.

## Replay tests (D4)

Replay tests protect only workflow-code determinism. Activities and SQL are covered by ordinary tests. Their replacement on DBOS is P2.5 and P7.1.

## Frozen adapter

The frozen adapter (P1.3) keeps T1–T13 and M1–M8 unchanged for the drain window. Once P1.3 lands, `src/runner/temporal/README.md` links here (PD1).
