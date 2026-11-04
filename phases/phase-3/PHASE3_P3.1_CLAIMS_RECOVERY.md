# P3.1 Claims and recovery off the DBOS path: no `step_claim`, no `recovery` rows, no reaper restarts, no start grace — DBOS recovery + `maxRecoveryAttempts` instead

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A7, A8, A11, A12; [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D3; [P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md).
Program: [`PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM.md`](PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM.md). Review: [`reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md`](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md).
Sources: research [reaper-anatomy](indexing/reaper-anatomy.md), [dbos-schedules-and-status](indexing/dbos-schedules-and-status.md).

## Design explained

**Claims (D1).** `modelStep` runs without a guard on DBOS ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D3), so no `step_claim` row is written. Duplicate concurrent executions of one step cannot happen on DBOS because one workflow id has one execution at a time; a re-run after a crash is the at-least-once case already accepted ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D4), and the guarded commit (`navier/runtime/model-step.ts:352-473`) still refuses a second step row.

**Recovery (D2).** A worker that restarts recovers its own PENDING workflows ([P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) D3) — this replaces `recoverOne` / `restart` (`navier/runtime/reaper.ts:229-306`). `navier.turn` is registered with `maxRecoveryAttempts: 3` (today's default, `navier/agents/limits.ts:13-28`); beyond it DBOS marks the workflow `MAX_RECOVERY_ATTEMPTS_EXCEEDED` (`dbos/dist/src/workflow.d.ts:148-164`) and the audit sweep closes the message `errored / recoveries_exhausted` ([P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md)). A per-version `maxRecoveries` lower than 3 is enforced by the sweep: `WorkflowStatus.recoveryAttempts` exists in 5.4.0 (`dbos/dist/src/workflow.d.ts:66-100`), so a PENDING turn whose count exceeds its version's limit is cancelled and closed `errored / recoveries_exhausted`. This settles the [U] behind [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) R3-F2 for implementation; that record stays as written.

**No `recovery` rows (D3).** The append-only `recovery` table (`navier/runtime/migrations/04_0012_recovery.ts:1-18`) is not written on DBOS; DBOS status + the message's terminal row are the audit.

**No grace (D4).** `START_GRACE_MS` (`navier/config.ts:11-18`) protected the reaper from racing an in-flight start; starts are now transactional ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D1), so DBOS code never reads it.

**Higher limits (D5).** A per-version value above 3 is capped at 3 and logged at publish time; the cap is the registration's.

## Context and scope

Audit rows A7, A8, A11, A12 ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).

## Goals and non-goals

**Goals**

- **G1 —** Zero `step_claim` / `recovery` writes from DBOS turns.
- **G2 —** Per-version limits ≤ 3 still honoured.

**Non-goals**

- Deleting the Temporal reaper (frozen).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| No guard | claims off | — | [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D3 |
| Recovery cap | registration option | dead-letter | DBOS |
| Per-version check | sweep | cancel + close | [P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| Grace | Temporal-only key | — | config |

## Decisions and rationale

### D1 — No `StepGuard` on DBOS

Guarded commit remains. [pass 1]

### D2 — Executor recovery + `maxRecoveryAttempts` 3

Per-version lower limits via the sweep from `recoveryAttempts`. [pass 2]

### D3 — No `recovery` rows

DBOS status is the audit. [pass 1]

### D4 — `START_GRACE_MS` Temporal-only

Never read by DBOS code. [pass 1]

### D5 — Limits above 3 capped

Logged at publish. [pass 2]

## Relevant cross-cutting concerns

Ops: dead-lettered turns are an alert ([P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: keep claims — guards a case DBOS ids prevent; D2: one registration per limit value — workflow name per limit, messy versioning | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D2 | Review fixes for R1-F1 ([round 1](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md#round-2) — VERDICT ready. | D5: raise the registration cap — one bad agent crashes workers more | [review round 1](reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md#round-1); new D5 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
