# P5.3 Rollback and compatibility — program design

Status: BINDING through pass 1
Architecture: [`PHASE5_P5.3_ROLLBACK_COMPAT.md`](PHASE5_P5.3_ROLLBACK_COMPAT.md) (BINDING through pass 2).
Depends on: [P5.3](PHASE5_P5.3_ROLLBACK_COMPAT.md) architecture.
Tickets: [`PHASE5_P5.3_ROLLBACK_COMPAT_TICKETS.md`](PHASE5_P5.3_ROLLBACK_COMPAT_TICKETS.md). Review: [`reviews/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM_REVIEW.md`](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Pre-deploy guard](#pd1--pre-deploy-guard) |

## Implementation explained

A pre-deploy check refuses a build without the DBOS runner while DBOS turns exist (PD1).

## Landing decisions

### PD1 — Pre-deploy guard

`scripts/deploy/guard-dbos-drain.ts`. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1 | Initial program spec. Reviewed in [round 1](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: runbook note only — forgotten under pressure | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
