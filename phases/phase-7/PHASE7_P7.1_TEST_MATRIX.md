# P7.1 DBOS test matrix: unit, workflow, recovery, harness and load tiers replacing replay tests

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md), [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md)–[P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md).
Program: [`PHASE7_P7.1_TEST_MATRIX_PROGRAM.md`](PHASE7_P7.1_TEST_MATRIX_PROGRAM.md). Review: [`reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md`](reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md).
Sources: research [retirement-surface](indexing/retirement-surface.md).

## Design explained

**Tiers (D1).** T1 step bodies with fakes (fast). T2 workflow tests: DBOS launched against a test Postgres, a turn runs end to end, assertions on Navier rows and `listWorkflowSteps` (`dbos/dist/src/dbos.d.ts:340`). T3 recovery: stop DBOS after step k (`shutdown` without completion), relaunch, assert each side-effecting step ran once (idempotency keys from [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md)). T4 shared harness ([P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md)). T5 load and chaos ([P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md)).

**Replay replacement (D2).** Temporal replay (`navier/temporal/replay.ts:1-45`) guarded history determinism. DBOS needs: (a) step boundaries stable across versions → a T2 test that starts a turn on version N, stops it, and resumes on N+1 with `DBOS.patch` paths (`dbos/dist/src/dbos.d.ts:718-728`); (b) workflow body free of non-step I/O → lint rule banning `db`, `fetch`, `Date.now` in workflow files.

**CI (D3).** T1–T3 on every PR; T4 nightly and pre-release; T5 per release.

## Context and scope

[P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A21: replay tests → replace.

## Goals and non-goals

**Goals**

- **G1 —** Every failure row of [P6.4](../phase-6/PHASE6_P6.4_FAILURE_MODES.md) has a test.

**Non-goals**

- Model quality tests.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| T1–T3 | PR tests | CI | DBOS |
| T4 | harness | nightly | [P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md) |
| T5 | load/chaos | release | [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md) |
| Lint | workflow purity | PR | D2 |

## Decisions and rationale

### D1 — Five tiers

As listed. [pass 2]

### D2 — Version-patch test + purity lint replace replay

Two checks. [pass 2]

### D3 — CI cadence

PR / nightly / release. [pass 1]

## Relevant cross-cutting concerns

Tests use ids-only payload assertions (L2).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md#round-1) — VERDICT fix-then-ready. | — | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md#round-2) — VERDICT ready. | D2: keep replay-style golden histories — DBOS has no history to replay | [review round 1](reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md#round-1); new D2 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
