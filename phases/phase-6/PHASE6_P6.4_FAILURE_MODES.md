# P6.4 Failure-mode table: detection, impact, automatic response and operator response for each failure

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md)–[P6.3](PHASE6_P6.3_OBSERVABILITY.md), [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md), [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md).
Program: [`PHASE6_P6.4_FAILURE_MODES_PROGRAM.md`](PHASE6_P6.4_FAILURE_MODES_PROGRAM.md). Review: [`reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md`](reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md).
Sources: [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).

## Design explained

| # | Failure | Detection | Automatic | Operator |
|---|---------|-----------|-----------|----------|
| F1 | Worker crash mid-step | PENDING on dead executor | same slot restart recovers; step retried | none |
| F2 | Slot lost permanently | alert D3 of [P6.3](PHASE6_P6.3_OBSERVABILITY.md) | none | start pod with lost ID ([P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) D5) |
| F3 | Postgres failover | probe fails | DBOS reconnect; steps retried | watch |
| F4 | Model provider outage | step retries exhausted | turn ends `errored` | none |
| F5 | Poison turn (crashes every attempt) | MAX_RECOVERY_ATTEMPTS_EXCEEDED | sweep closes row `errored` ([P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md)) | inspect |
| F6 | Queue backlog | lag alert | none | scale slots |
| F7 | Stop not delivered | stop poll fallback ([P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md)) | abort within poll interval | none |
| F8 | NOTIFY listener down | reconnect backoff (`navier/db/listen.ts:1-40`) | SSE replays from delta table | none |
| F9 | Bad deploy (replay mismatch) | ERROR spike on new version | old slots keep old version | roll back version ([P5.3](../phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md)) |
| F10 | Authz-engine unavailable (same DB) | AZ unavailable code | fail-closed, turn step denied with retryable error ([P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md)) | none |

Every row has a test in [P6.5](PHASE6_P6.5_LOAD_CHAOS.md) or [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) (D2).

## Context and scope

Replaces reaper-based recovery reasoning.

## Goals and non-goals

**Goals**

- **G1 —** No failure without detection.

**Non-goals**

- Disaster recovery of Postgres (platform).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Table | 10 rows | ops | all |
| Tests | per row | [P6.5](PHASE6_P6.5_LOAD_CHAOS.md) | [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |

## Decisions and rationale

### D1 — Failure-mode table

10 rows. [pass 2]

### D2 — Each row has a test

Owner unit named. [pass 1]

## Relevant cross-cutting concerns

Runbook links ([P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: keep reaper as catch-all — the thing being removed | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE6_P6.4_FAILURE_MODES_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
