# P4.5 Removal of the old gRPC authz client — program design

Status: BINDING through pass 1
Architecture: [`PHASE4_P4.5_GRPC_REMOVAL.md`](PHASE4_P4.5_GRPC_REMOVAL.md) (BINDING through pass 2).
Depends on: [P4.5](PHASE4_P4.5_GRPC_REMOVAL.md) architecture.
Tickets: [`PHASE4_P4.5_GRPC_REMOVAL_TICKETS.md`](PHASE4_P4.5_GRPC_REMOVAL_TICKETS.md). Review: [`reviews/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Single deletion commit](#pd1--single-deletion-commit) |
| PD2 | [Criterion check](#pd2--criterion-check) |

## Implementation explained

Delete in one commit after the 14-day criterion, guarded by `rg` bans (PD1).

## Landing decisions

### PD1 — Single deletion commit

Easy revert. [pass 1]

### PD2 — Criterion check

Ticket 1 verifies every org has been `engine` for 14 days. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2 | Initial program spec. Reviewed in [round 1](reviews/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: gradual deletes — half-removed client | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
