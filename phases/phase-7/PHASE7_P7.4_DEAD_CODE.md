# P7.4 Temporal retirement and dead-code removal: delete temporal/ and its wiring; stop writes to step_claim/recovery; re-judge the audit sweep; close the P0.4 checklist

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md), [P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md), [P7.1](PHASE7_P7.1_TEST_MATRIX.md).
Program: [`PHASE7_P7.4_DEAD_CODE_PROGRAM.md`](PHASE7_P7.4_DEAD_CODE_PROGRAM.md). Review: [`reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md`](reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md).
Sources: research [retirement-surface](indexing/retirement-surface.md); [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).

## Design explained

**Delete (D1).** `temporal/*` (`navier/temporal/worker.ts:46-92`, `navier/temporal/replay.ts:1-45`), `workflows.ts`, `activities.ts`, `runtime/activities.ts`, the restart and lost-start parts of `runtime/reaper.ts`, `runtime/schedule.ts` Temporal schedule, `src/runner/temporal/`, `@temporalio/*` packages, `TEMPORAL_*` config keys, `temporalProbe` from the worker (`navier/worker.ts:1-30`). `RUNNER_*` flags collapse to DBOS only; the `Runner` seam stays (cheap, keeps tests clean).

**Re-judge the audit sweep (D2).** [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) R3-F1 asked whether the audit sweep is a reaper in disguise. Verdict: it stays — it never restarts work, it only closes rows whose workflow is terminal or missing ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md)). If it closes zero rows for 90 days in production, delete it and keep only the alert.

**Tables (D3).** Stop writing `step_claim` and `recovery` (`navier/runtime/tables.ts:131-151`); keep them read-only (owner decision 5). Dropping is an owner gate.

**Checklist (D4).** Close each [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) row: replace rows verified by the replacing unit's tests, delete rows by this unit's diff, keep and simplify rows by their unit.

## Context and scope

"simplify it to the minimum".

## Goals and non-goals

**Goals**

- **G1 —** No Temporal code or dependency after retirement.

**Non-goals**

- Dropping tables without the owner.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Delete list | files + deps | one PR | D1 |
| Sweep verdict | keep with expiry | D2 | [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| Tables | read-only | gate | D3 |
| Checklist | P0.4 rows | close | D4 |

## Decisions and rationale

### D1 — Delete Temporal code and deps

After sign-off. [pass 2]

### D2 — Audit sweep kept with 90-day expiry review

Not a reaper. [pass 1]

### D3 — step_claim/recovery read-only

Drop is owner gate. [pass 1]

### D4 — Close the P0.4 checklist

Per row. [pass 1]

## Relevant cross-cutting concerns

Deletion PR reverts cleanly.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: keep frozen adapter forever — contradicts minimum; D3: drop in retirement release — owner decision 5 | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
