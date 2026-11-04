# P7.1 DBOS test matrix — program design

Status: BINDING through pass 1
Architecture: [`PHASE7_P7.1_TEST_MATRIX.md`](PHASE7_P7.1_TEST_MATRIX.md) (BINDING through pass 2).
Depends on: [P7.1](PHASE7_P7.1_TEST_MATRIX.md) architecture.
Tickets: [`PHASE7_P7.1_TEST_MATRIX_TICKETS.md`](PHASE7_P7.1_TEST_MATRIX_TICKETS.md). Review: [`reviews/PHASE7_P7.1_TEST_MATRIX_PROGRAM_REVIEW.md`](reviews/PHASE7_P7.1_TEST_MATRIX_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Template-database per test worker](#pd1--template-database-per-test-worker) |
| PD2 | [Purity lint](#pd2--purity-lint) |

## Implementation explained

Test Postgres per worker via template database (PD1); lint as a custom rule over `src/runner/dbos/workflows/**` (PD2).

## Landing decisions

### PD1 — Template-database per test worker

Fast isolation. [pass 1]

### PD2 — Purity lint

Bans I/O imports. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2 | Initial program spec. Reviewed in [round 1](reviews/PHASE7_P7.1_TEST_MATRIX_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: one shared DB — flaky | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
