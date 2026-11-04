# P0.2 Temporal inventory and what the machinery around it is for — program design

Status: BINDING through pass 1
Architecture: [`PHASE0_P0.2_TEMPORAL_INVENTORY.md`](PHASE0_P0.2_TEMPORAL_INVENTORY.md) (BINDING through pass 2).
Depends on: [P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md) architecture.
Tickets: [`PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md`](PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md). Review: [`reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM_REVIEW.md`](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Doc beside the adapter](#pd1--doc-beside-the-adapter) |

## Implementation explained

Land the two tables as a doc next to the frozen adapter so whoever retires it later knows what each piece did (PD1).

## Program layout and construction

```text
docs/runner/temporal-inventory.md
```

[pass 1]

## Call sites and integration

Read by [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) and [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) tickets. [pass 1]

## Landing decisions

### PD1 — Doc beside the adapter

`docs/runner/temporal-inventory.md`, linked from `src/runner/temporal/README.md` once [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) lands. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, layout, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: inline comments in each file — scattered | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
