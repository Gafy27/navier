# P1.2 Port every runner call site to the interface — program design

Status: BINDING through pass 2
Architecture: [`PHASE1_P1.2_OPERATIONS_PORT.md`](PHASE1_P1.2_OPERATIONS_PORT.md) (BINDING through pass 1).
Depends on: [P1.2](PHASE1_P1.2_OPERATIONS_PORT.md) architecture; [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) program.
Tickets: [`PHASE1_P1.2_OPERATIONS_PORT_TICKETS.md`](PHASE1_P1.2_OPERATIONS_PORT_TICKETS.md). Review: [`reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md`](reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| Test seams | [Test seams](#test-seams) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Port in three groups](#pd1--port-in-three-groups) |
| PD2 | [Handler and SDK: types only](#pd2--handler-and-sdk-types-only) |

## Implementation explained

One ticket per group of sites so each lands green with Temporal only (PD1). The chat handler and the SDK runtime change only their deps types (PD2).

## Program layout and construction

```text
src/runner/runners.ts
src/runtime/start.ts, stop.ts, decide.ts, revise.ts, activities.ts
src/sdk/turn.ts, src/sdk/runtime.ts
src/worker.ts, src/api.ts, src/api/routes/chat/handler.ts
```

[pass 1]

## Call graph and execution flow

handler → startTurn(deps.runners) → tx → runners.forStart(org).start(tx, ref). [pass 1]

## Test seams

Fake `Runners` in domain tests. [pass 1]

## Call sites and integration

All thirteen in the architecture table. [pass 2]

## Landing decisions

### PD1 — Port in three groups

start sites; stop/decide; await + composition. [pass 1]

### PD2 — Handler and SDK: types only

No logic change in routes. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, layout, callgraph, seams, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: one big-bang ticket — unreviewable | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | callsites | Review fixes for R1-F1 ([round 1](reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md#round-1); new PD2 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
