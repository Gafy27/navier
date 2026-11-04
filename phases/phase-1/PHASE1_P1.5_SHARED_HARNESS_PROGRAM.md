# P1.5 Shared runner conformance harness — program design

Status: BINDING through pass 1
Architecture: [`PHASE1_P1.5_SHARED_HARNESS.md`](PHASE1_P1.5_SHARED_HARNESS.md) (BINDING through pass 2).
Depends on: [P1.5](PHASE1_P1.5_SHARED_HARNESS.md) architecture.
Tickets: [`PHASE1_P1.5_SHARED_HARNESS_TICKETS.md`](PHASE1_P1.5_SHARED_HARNESS_TICKETS.md). Review: [`reviews/PHASE1_P1.5_SHARED_HARNESS_PROGRAM_REVIEW.md`](reviews/PHASE1_P1.5_SHARED_HARNESS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| Test seams | [Test seams](#test-seams) |
| PD1 | [Scenarios as data](#pd1--scenarios-as-data) |
| PD2 | [One file per leg](#pd2--one-file-per-leg) |

## Implementation explained

Scenarios are data; the harness reads them (PD1). Each leg is a separate test file so CI can run them in parallel (PD2).

## Program layout and construction

```text
test/conformance/harness.ts
test/conformance/fakes.ts
test/conformance/scenarios.ts
test/conformance/dbos.test.ts
test/conformance/temporal.test.ts
```

[pass 1]

## Call graph and execution flow

scenario → domain (postTurn/requestStop/decide) → runner → rows → expect. [pass 1]

## Test seams

Disposable Postgres per file. [pass 1]

## Landing decisions

### PD1 — Scenarios as data

One array of scripts and expectations. [pass 1]

### PD2 — One file per leg

Parallel CI. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, layout, callgraph, seams | Initial program spec. Reviewed in [round 1](reviews/PHASE1_P1.5_SHARED_HARNESS_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: one test function per scenario — duplication | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
