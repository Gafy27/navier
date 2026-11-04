# P3.3 Schedules: the turn audit sweep and the stream sweep: two DBOS scheduled workflows; the reaper shrinks to "close what no workflow will close"

Status: BINDING through pass 3
Depends on: product contract [`README.md`](../../README.md); [P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md), [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D4, A18.
Program: [`PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM.md`](PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM.md). Review: [`reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md`](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md).
Sources: research [reaper-anatomy](indexing/reaper-anatomy.md), [dbos-schedules-and-status](indexing/dbos-schedules-and-status.md); `navier/runtime/stream-sweep.ts:25-45`.

## Design explained

**Audit sweep (D1).** A DBOS scheduled workflow `navier.auditSweep`, cron `* * * * *`, declared with `applySchedules` (`dbos/dist/src/dbos.d.ts:792-800`). One step per batch:

1. Read up to `REAPER_BATCH_SIZE` (`navier/runtime/config.ts:4-13`) agent messages whose newest status is `created` or `paused`, owned by DBOS ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4), older than 1 minute.
2. Look up their workflows with `listWorkflows({ workflowIDs })` (`dbos/dist/src/dbos.d.ts:340`).
3. Terminal without a terminal row (`ERROR`, `CANCELLED`, `MAX_RECOVERY_ATTEMPTS_EXCEEDED`) → `closeTurn(errored, recoveries_exhausted | turn_ended, expected = newest)`.
4. PENDING with `recoveryAttempts` above the version's `maxRecoveries` ([P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md) D2) → `cancelWorkflow`, then close as in 3.
5. Missing workflow → during the drain window only (rows written by the fallback start of [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) C or before cutover), enqueue it; afterwards close `errored`.

Stop rows win: if a stop row exists, the close uses the stop status ([P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) L1).

**Stream sweep (D2).** The SQL half of today's sweep (`navier/runtime/stream-sweep.ts:25-45`) runs as `navier.streamSweep` every `STREAM_SWEEP_INTERVAL_MS`; the delete-only-when-expired trigger stays (`navier/runtime/migrations/13_0006_stream_delta_sweep.ts:1-27`).

**No overlap (D3).** Scheduled workflows get the fire time in their id, so a duplicate fire is a no-op; batches are bounded, so a slow run cannot pile up (replaces Temporal overlap SKIP, `navier/runtime/schedule.ts:19-56`).

**What is not here (D4).** No restart, no recovery claim, no pause expiry — those are DBOS recovery and `recv` deadlines.

## Context and scope

Audit rows A10, A18; [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) R3-F1 asks whether the sweep is still needed after Temporal retires — [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) re-judges it.

## Goals and non-goals

**Goals**

- **G1 —** Every open DBOS-owned row closes within ~2 min of its workflow becoming terminal.
- **G2 —** Sweep SQL is bounded.

**Non-goals**

- Restarting work.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Audit sweep | orphan closes | closed rows | DBOS status |
| Stream sweep | expired deltas | deletes | trigger |
| Schedules | cron | applySchedules | worker boot |

## Decisions and rationale

### D1 — Turn audit sweep

Steps 1–5 above. [pass 3]

### D2 — Stream sweep as DBOS schedule

Same SQL. [pass 1]

### D3 — Idempotent fires, bounded batches

Replaces overlap SKIP. [pass 1]

### D4 — No restart/claim/expiry

DBOS-native. [pass 1]

## Relevant cross-cutting concerns

Metrics: closes by reason ([P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: no sweep — dead-lettered workflows would leave open rows forever; D2: TTL via pg_cron — new extension | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-2) — VERDICT fix-then-ready. | — | [review round 1](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-1) |
| 3 | 2026-11-04 | BINDING | D1 | Review fixes for R2-F1 ([round 2](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md#round-2); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
