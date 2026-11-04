# P4.2 Navier as an authz-engine model — program design

Status: BINDING through pass 1
Architecture: [`PHASE4_P4.2_NAVIER_MODEL.md`](PHASE4_P4.2_NAVIER_MODEL.md) (BINDING through pass 3).
Depends on: [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) architecture.
Tickets: [`PHASE4_P4.2_NAVIER_MODEL_TICKETS.md`](PHASE4_P4.2_NAVIER_MODEL_TICKETS.md). Review: [`reviews/PHASE4_P4.2_NAVIER_MODEL_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.2_NAVIER_MODEL_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| PD1 | [Model as a file](#pd1--model-as-a-file) |
| PD2 | [One mapping module](#pd2--one-mapping-module) |

## Implementation explained

The model and scenarios are files compiled by authz-engine (PD1); `mapping.ts` is the single place legacy calls become tuple batches, used by the engine adapter and by import (PD2).

## Program layout and construction

```text
src/authz/engine/model/navier.fga
src/authz/engine/model/navier.scenarios.authz.yaml
src/authz/engine/mapping.ts
```

[pass 1]

## Call graph and execution flow

writes.publishAgentVersion → mapping.publish(...) → engine `write(batch)`. [pass 1]

## Landing decisions

### PD1 — Model as a file

Compiled and provisioned by authz-engine. [pass 1]

### PD2 — One mapping module

Shared by the adapter and [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) import. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, layout, callgraph | Initial program spec. Reviewed in [round 1](reviews/PHASE4_P4.2_NAVIER_MODEL_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD2: mapping in each adapter method — drift from import | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
