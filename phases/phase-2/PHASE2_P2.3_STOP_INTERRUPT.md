# P2.3 Stop, interrupt and graceful stop on DBOS: row + `send_message` + `NOTIFY` in the stop transaction; worker abort hub; boundary `checkStop` step

Status: BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04
Depends on: product contract [`README.md`](../../README.md); [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md), [P2.2](PHASE2_P2.2_STEPS_RETRIES.md).
Program: [`PHASE2_P2.3_STOP_INTERRUPT_PROGRAM.md`](PHASE2_P2.3_STOP_INTERRUPT_PROGRAM.md). Review: [`reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md`](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md).
Sources: research [stop-and-pause-paths](indexing/stop-and-pause-paths.md); `navier/db/listen.ts:16-98`.

## Design explained

**Write side (D1).** `requestStop` keeps its row insert (`navier/runtime/stop.ts:100-126`). For a DBOS-owned turn ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4) the same transaction also runs `SELECT dbos.send_message(wfId, '{"kind":"stop"}', 'turn', 'stop:' || kind)` (`dbos/dist/src/sysdb_migrations/internal/migrations.js:361-380`) — which wakes a workflow waiting in `recv` — and `NOTIFY navier_turn_stop, wfId` (`navier/db/listen.ts:16-22`), delivered on commit. The message is ids-only.

**Worker side (D2).** One `StopHub` per worker holds a LISTEN connection built on `createListener` (reconnecting, `navier/db/listen.ts:34-98`) and a map `workflowId → AbortController` for in-flight model and tool steps. A step **registers first, then reads** the stop row, so a stop committed just before the step started is seen by the read and one committed after is seen by the notification. On listener reconnect the hub re-reads stop rows for all registered workflows (missed notifications).

**Boundary (D3).** `checkStop` is a step run before every model step and before every tool pool. It returns `cancel` / `interrupt` (stop row) or `graceful` (an open pending message for the thread, `navier/runtime/pending.ts:110-140`) or none. This replaces the graceful signal (`navier/runtime/stop.ts:38-56`) — graceful needs no wake because it only acts at boundaries, exactly like today's `stoppedEnd` (`navier/runtime/turn-loop.ts:55-66`).

**Abort (D4).** An aborted step throws `StopAbort`; `shouldRetry` refuses it; the workflow maps it to `cancelled` or `interrupted` like the cancellation catch today (`navier/runtime/turn-loop.ts:202-213`); `finishTurn` cancels open actions (`navier/runtime/close.ts:47-125`).

**Paused (D5).** A paused workflow is in `recv('turn')`; the stop message wakes it; it finishes with the stop status. Stop wins over a decision or expiry that arrives in the same wait (L1), as the reaper rule does today (`navier/runtime/reaper.ts:108-138`).

**Not cancelWorkflow (D6).** `DBOS.cancelWorkflow` runs no further workflow code, so `finishTurn` would never run.

**Fallback (D7).** While the listener is down, the hub polls stop rows of registered workflows every second.

## Context and scope

Audit rows A2, A3 ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).

## Goals and non-goals

**Goals**

- **G1 —** Stop takes effect within ~1 s of commit during a step.
- **G2 —** No stop is lost across reconnects or crashes.

**Non-goals**

- Changing stop API semantics or the stop row.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Stop tx | row + send + notify | one commit | stop.ts |
| StopHub | abort map | signal per workflow | db/listen.ts |
| checkStop | boundary read | stop kind | pending.ts |
| Wait wake | recv message | paused stop | [P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md) |

## Decisions and rationale

### D1 — Stop tx: row + send_message + NOTIFY

All in the API transaction. [pass 3]

### D2 — StopHub: register then read; re-read on reconnect

One LISTEN connection per worker. [pass 3]

### D3 — Boundary `checkStop` step

Graceful needs no wake. [pass 2]

### D4 — `StopAbort` not retried

Maps to cancelled/interrupted. [pass 1]

### D5 — Paused stop via recv

Stop message wakes the wait. [pass 1]

### D6 — No `cancelWorkflow`

Finish must run. [pass 1]

### D7 — Poll fallback

1 s while the listener is down. [pass 3]

## Invariants

- **L1 —** A committed stop row wins over any later decision or expiry for the same message. [pass 1]

## Unresolved questions and blockers

Open review findings at BINDING: R3-F1, R3-F2 — see [`reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md`](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md). The owner request (pt151u) authorizes BINDING after three rounds; these items keep their owners in the review Response tables.

## Relevant cross-cutting concerns

Ops: listener health is a readiness input ([P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-1) — VERDICT not-ready. | D1: signal after commit — lost on crash; D2: read then register — race window; D6: cancelWorkflow — no finish code | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D2, D3 | Review fixes for R1-F1, R1-F2 ([round 1](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-1) |
| 3 | 2026-11-04 | BINDING | D2, D1 | Review fixes for R2-F1, R2-F2 ([round 2](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-3) — VERDICT not-ready. | D7: poll only — 1 s DB load per in-flight turn always | [review round 2](reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md#round-2); new D7 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after round 3 not-ready — unresolved R3-F1, R3-F2 accepted as recorded in the review file |
