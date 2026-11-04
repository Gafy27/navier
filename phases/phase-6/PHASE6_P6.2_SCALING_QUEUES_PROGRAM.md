# P6.2 Queues, partitions and sizing — program design

Status: BINDING through pass 1
Architecture: [`PHASE6_P6.2_SCALING_QUEUES.md`](PHASE6_P6.2_SCALING_QUEUES.md) (BINDING through pass 2).
Depends on: [P6.2](PHASE6_P6.2_SCALING_QUEUES.md) architecture.
Tickets: [`PHASE6_P6.2_SCALING_QUEUES_TICKETS.md`](PHASE6_P6.2_SCALING_QUEUES_TICKETS.md). Review: [`reviews/PHASE6_P6.2_SCALING_QUEUES_PROGRAM_REVIEW.md`](reviews/PHASE6_P6.2_SCALING_QUEUES_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Queue limits from config](#pd1--queue-limits-from-config) |

## Implementation explained

Limits from `RunnerConfigSchema` (PD1).

## Landing decisions

### PD1 — Queue limits from config

`DBOS_TURNS_WORKER_CONCURRENCY`. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1 | Initial program spec. Reviewed in [round 1](reviews/PHASE6_P6.2_SCALING_QUEUES_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: hard-coded — no per-env sizing | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
