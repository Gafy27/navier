# P1.3 Temporal as a frozen adapter — program design

Status: BINDING through pass 3
Architecture: [`PHASE1_P1.3_TEMPORAL_FREEZE.md`](PHASE1_P1.3_TEMPORAL_FREEZE.md) (BINDING through pass 2).
Depends on: [P1.3](PHASE1_P1.3_TEMPORAL_FREEZE.md) architecture.
Tickets: [`PHASE1_P1.3_TEMPORAL_FREEZE_TICKETS.md`](PHASE1_P1.3_TEMPORAL_FREEZE_TICKETS.md). Review: [`reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md`](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| Test seams | [Test seams](#test-seams) |
| PD1 | [Pure move first](#pd1--pure-move-first) |
| PD2 | [Adapter wraps existing functions](#pd2--adapter-wraps-existing-functions) |
| PD3 | [Guard last](#pd3--guard-last) |

## Implementation explained

Move first with imports fixed and no behaviour change (PD1); then add the adapter that implements `TurnRunner` with existing functions (PD2); then inject the guard (PD3).

## Types, signatures, and caller contracts

```ts
// src/runtime/model-step.ts (addition)
export interface StepGuard { claim(tx: Tx, key: StepKey, attempt: number): Promise<Result<'claimed' | 'taken'>> }
export interface ModelStepDeps { /* existing */ readonly guard?: StepGuard }
// src/runner/temporal/adapter.ts
export function createTemporalRunner(handle: TemporalHandle, deps: AdapterDeps): TurnRunner;
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | move ticket | `git mv` + import fixes |
| D3 | `model-step.ts` | `guard?.claim` |
| D4 | [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) | deletion |
| L1 | `commands.deps` | rule |

[pass 1]

## Program layout and construction

```text
src/runner/temporal/{adapter,client,worker,trace,attributes,probe,replay,workflow-interceptors}.ts
src/runner/temporal/{workflow,turn-loop,activities,reaper,schedule,stream-sweep-schedule,step-claim}.ts
src/runner/temporal/README.md
```

[pass 3]

## Call graph and execution flow

Temporal workflow → activities → `TurnSteps` (+ `guard` = step-claim). [pass 1]

## Test seams

Existing Temporal tests; harness ([P1.5](PHASE1_P1.5_SHARED_HARNESS.md)). [pass 1]

## Landing decisions

### PD1 — Pure move first

Separate commit, no logic diff. [pass 1]

### PD2 — Adapter wraps existing functions

`start` = after-commit `startCommitted`; `wakeStop` = signal; `wakeDecision` = restart; `awaitEnd` = handle result. [pass 2]

### PD3 — Guard last

Inject after the move so diffs stay small. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, types, owners, layout, callgraph, seams | Initial program spec. Reviewed in [round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: move and change together — hides behaviour edits | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | PD2 | Review fixes for R1-F1 ([round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-2) — VERDICT fix-then-ready. | — | [review round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-1); new PD3 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | layout | Review fixes for R2-F1 ([round 2](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md#round-2); BINDING by owner request (pt151u) after VERDICT ready |
