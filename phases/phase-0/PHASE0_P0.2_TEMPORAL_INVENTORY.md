# P0.2 Temporal inventory and what the machinery around it is for: every Temporal feature Navier uses, and the cause behind each compensation

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md).
Program: [`PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md`](PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md). Review: [`reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md`](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md).
Sources: research [temporal-surface](indexing/temporal-surface.md).

## Design explained

**What Temporal provides to Navier (D1).**

| # | Feature | Where | Used for |
|---|---------|-------|----------|
| T1 | Durable workflow + activity retry | `navier/runtime/workflow.ts:25-37`, `navier/runtime/activities.ts:89-103` | turn survives worker loss; `unavailable`/`aborted` retry, `parseArgs` non-retryable |
| T2 | Signals | `navier/runtime/workflow.ts:20-22` | cancel, graceful_stop, interrupt |
| T3 | Cancellation scopes | `navier/runtime/turn-loop.ts:21-38`, `navier/runtime/turn-loop.ts:192-228` | abort in-flight activity; non-cancellable pause/finish |
| T4 | continue-as-new | `navier/runtime/turn-loop.ts:79-87` | bound history length (`MAX_HISTORY_LENGTH`, `navier/config.ts:11-18`) |
| T5 | Workflow id conflict/reuse | `navier/runtime/start.ts:42-69` | one running workflow per message; restart after pause |
| T6 | Search attribute OrgId | `navier/temporal/attributes.ts:1-16` | per-org listing |
| T7 | Schedules | `navier/runtime/schedule.ts:19-56`, `navier/runtime/stream-sweep.ts:57-95` | reaper, stream sweep |
| T8 | Interceptors + trace header | `navier/temporal/trace.ts:18-74`, `navier/temporal/workflow-interceptors.ts:12-42` | trace id across client/workflow/activity |
| T9 | Activity attempt | `navier/temporal/trace.ts:58-74`, `navier/runtime/tool-call.ts:440-467` | detect an interrupted tool call |
| T10 | Replay tests | `navier/temporal/replay.ts:13-45`, `navier/temporal/replay.test.ts:1-33` | determinism of workflow code |
| T11 | Health probe | `navier/temporal/probe.ts:8-37` | readiness |
| T12 | Worker bootstrap | `navier/temporal/worker.ts:50-92`, `navier/worker.ts:119-199` | task queue, activities, schedules |
| T13 | Client handle / result | `navier/temporal/client.ts:14-33`, `navier/sdk/turn.ts:135-146` | start, signal, `awaitTurn` |

**What the surrounding machinery is for (D2).** Each piece covers a gap in how Navier uses Temporal:

| # | Machinery | Where | Cause |
|---|-----------|-------|-------|
| M1 | Reaper restart of stale turns | `navier/runtime/reaper.ts:69-96`, `navier/runtime/reaper.ts:272-306` | the start is not atomic with the rows (start after commit, `navier/runtime/start.ts:83-112`); a workflow can end without closing its message |
| M2 | `recovery` table + `maxRecoveries` | `navier/runtime/reaper.ts:194-226`, `navier/agents/limits.ts:13-28` | cap reaper restarts per message (append-only audit) |
| M3 | Reaper pause-expiry pass | `navier/runtime/reaper.ts:388-512` | a paused turn has no workflow to time it out |
| M4 | `step_claim` | `navier/runtime/model-step.ts:210-249`, `navier/runtime/migrations/04_0010_step_claim.ts:1-18` | a retried or duplicated activity must not call the model twice for one step |
| M5 | `stop_requested` row | `navier/runtime/stop.ts:64-140` | a stop must survive states with no running workflow (paused, not yet started) |
| M6 | decide restart | `navier/runtime/decide.ts:514-533` | pause ended the workflow |
| M7 | `START_GRACE_MS` grace window | `navier/config.ts:11-18`, `navier/runtime/reaper.ts:69-96` | the reaper must not race a start that is still in flight |
| M8 | Pending graceful signal | `navier/runtime/start.ts:130-179` | a running turn must yield to a queued user message |

**Not relied on (D3).** Navier never reads workflow history as state, never uses queries, updates, child workflows or local activities; a turn's truth is rows ([P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md) D1).

**Replay tests (D4)** protect only workflow-code determinism; activities and SQL are covered by ordinary tests.

## Context and scope

Ten files import `@temporalio/*` directly ([temporal-surface](indexing/temporal-surface.md)).

## Goals and non-goals

**Goals**

- **G1 —** Name every Temporal use with a line range.
- **G2 —** State the cause of each compensation, so [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) can delete causes, not symptoms.

**Non-goals**

- Verdicts ([P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).
- DBOS mapping ([P0.3](PHASE0_P0.3_DBOS_FIT.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Feature inventory | T1–T13 | table | [P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md) map |
| Cause table | M1–M8 | table | reaper, start, stop |
| Non-reliance | D3 | list | code reading |

## Decisions and rationale

### D1 — Thirteen Temporal features in use

Table T1–T13 is the complete list at the pin. [pass 1]

### D2 — Eight compensations with causes

Table M1–M8; M7 added after review. [pass 2]

### D3 — History is not state

No queries, updates, child workflows; truth is rows. [pass 1]

### D4 — Replay tests cover workflow determinism only

Their replacement on DBOS is [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) and [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md). [pass 1]

## Relevant cross-cutting concerns

The frozen adapter ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md)) keeps T1–T13 and M1–M8 unchanged for the drain window.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: list only imports — misses signals and attempts semantics; D2: treat the reaper as one piece — hides three causes | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D2 | Review fixes for R1-F1 ([round 1](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
