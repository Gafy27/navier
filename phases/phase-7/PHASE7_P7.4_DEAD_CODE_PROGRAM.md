# P7.4 Temporal retirement and dead-code removal — program design

Status: BINDING through pass 1
Architecture: [`PHASE7_P7.4_DEAD_CODE.md`](PHASE7_P7.4_DEAD_CODE.md) (BINDING through pass 2).
Depends on: [P7.4](PHASE7_P7.4_DEAD_CODE.md) architecture.
Tickets: [`PHASE7_P7.4_DEAD_CODE_TICKETS.md`](PHASE7_P7.4_DEAD_CODE_TICKETS.md). Review: [`reviews/PHASE7_P7.4_DEAD_CODE_PROGRAM_REVIEW.md`](reviews/PHASE7_P7.4_DEAD_CODE_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Deletion manifest](#pd1--deletion-manifest) |
| PD2 | [No-temporal guard](#pd2--no-temporal-guard) |

## Implementation explained

Delete list as a checked manifest (PD1); CI guard fails on any `@temporalio` import (PD2).

## Landing decisions

### PD1 — Deletion manifest

Checked file list. [pass 1]

### PD2 — No-temporal guard

CI. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2 | Initial program spec. Reviewed in [round 1](reviews/PHASE7_P7.4_DEAD_CODE_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: incremental deletes — long half-state | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
