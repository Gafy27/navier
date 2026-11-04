# P3.3 Schedules: the turn audit sweep and the stream sweep — program design

Status: BINDING through pass 1
Architecture: [`PHASE3_P3.3_SCHEDULES_SWEEPS.md`](PHASE3_P3.3_SCHEDULES_SWEEPS.md) (BINDING through pass 3).
Depends on: [P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md) architecture.
Tickets: [`PHASE3_P3.3_SCHEDULES_SWEEPS_TICKETS.md`](PHASE3_P3.3_SCHEDULES_SWEEPS_TICKETS.md). Review: [`reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM_REVIEW.md`](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| PD1 | [One step per batch](#pd1--one-step-per-batch) |
| PD2 | [applySchedules at boot](#pd2--applyschedules-at-boot) |

## Implementation explained

Each sweep is a workflow with one step per batch (PD1); `schedules.ts` calls `applySchedules` at boot after `launch` (PD2).

## Program layout and construction

```text
src/runner/dbos/audit-sweep.ts
src/runner/dbos/stream-sweep.ts
src/runner/dbos/schedules.ts
```

[pass 1]

## Call graph and execution flow

cron → `navier.auditSweep(firedAt)` → step batch → closeTurn per row. [pass 1]

## Landing decisions

### PD1 — One step per batch

Loop until a batch is short, max 10 batches per fire. [pass 1]

### PD2 — applySchedules at boot

Idempotent; worker only. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, layout, callgraph | Initial program spec. Reviewed in [round 1](reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: one step per row — step count explosion | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
