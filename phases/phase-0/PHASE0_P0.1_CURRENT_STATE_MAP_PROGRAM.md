# P0.1 Current-state map of one agent turn — program design

Status: BINDING through pass 2
Architecture: [`PHASE0_P0.1_CURRENT_STATE_MAP.md`](PHASE0_P0.1_CURRENT_STATE_MAP.md) (BINDING through pass 1).
Depends on: [P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md) architecture.
Tickets: [`PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md`](PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md). Review: [`reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md`](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Test seams | [Test seams](#test-seams) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [One map file in the Navier repo](#pd1--one-map-file-in-the-navier-repo) |
| PD2 | [Anchors are function name + range](#pd2--anchors-are-function-name--range) |

## Implementation explained

The only landing is a documentation file in the Navier repository so implementers have the map next to the code (PD1). Anchors are function names plus line ranges at the zip pin; a later ticket that moves code updates the doc (PD2).

## Program layout and construction

```text
docs/runner/current-state.md
```

[pass 1]

## Test seams

none (documentation). [pass 1]

## Call sites and integration

Read by every implementer session in [Phase 1](../phase-1/README.md)–[Phase 3](../phase-3/README.md). [pass 1]

## Landing decisions

### PD1 — One map file in the Navier repo

`docs/runner/current-state.md`, copied from the table in the architecture with its anchors. [pass 1]

### PD2 — Anchors are function name + range

Ranges drift after edits; the function name stays the stable key. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, layout, seams, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: keep the map only in this design repo — invisible to implementers | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | PD2 | Review fixes for R1-F1 ([round 1](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | PD2: line ranges only — break on first edit | [review round 1](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md#round-1); new PD2 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
