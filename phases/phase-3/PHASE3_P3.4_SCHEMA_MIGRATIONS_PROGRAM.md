# P3.4 Schema and config inventory after simplification — program design

Status: BINDING through pass 2
Architecture: [`PHASE3_P3.4_SCHEMA_MIGRATIONS.md`](PHASE3_P3.4_SCHEMA_MIGRATIONS.md) (BINDING through pass 1).
Depends on: [P3.4](PHASE3_P3.4_SCHEMA_MIGRATIONS.md) architecture.
Tickets: [`PHASE3_P3.4_SCHEMA_MIGRATIONS_TICKETS.md`](PHASE3_P3.4_SCHEMA_MIGRATIONS_TICKETS.md). Review: [`reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md`](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| PD1 | [Deploy step before workers](#pd1--deploy-step-before-workers) |

## Implementation explained

Documentation plus one deploy step (PD1).

## Program layout and construction

```text
docs/runner/schema.md
scripts/deploy/dbos-migrate.ts
```

[pass 1]

## Landing decisions

### PD1 — Deploy step before workers

Fails the deploy if migrate fails. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, layout | Initial program spec. Reviewed in [round 1](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: manual migrate — forgotten | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | PD1 | Review fixes for R1-F1 ([round 1](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready |
