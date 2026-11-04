# P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API — program design

Status: BINDING through pass 1
Architecture: [`PHASE0_P0.3_DBOS_FIT.md`](PHASE0_P0.3_DBOS_FIT.md) (BINDING through pass 3).
Depends on: [P0.3](PHASE0_P0.3_DBOS_FIT.md) architecture.
Tickets: [`PHASE0_P0.3_DBOS_FIT_TICKETS.md`](PHASE0_P0.3_DBOS_FIT_TICKETS.md). Review: [`reviews/PHASE0_P0.3_DBOS_FIT_PROGRAM_REVIEW.md`](reviews/PHASE0_P0.3_DBOS_FIT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Doc with tags](#pd1--doc-with-tags) |
| PD2 | [Each [U] has a test owner](#pd2--each-u-has-a-test-owner) |

## Implementation explained

Land the mapping as a doc and turn each `[U]` into a named test owned by a later ticket (PD1, PD2).

## Program layout and construction

```text
docs/runner/dbos-fit.md
```

[pass 1]

## Call sites and integration

[P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 1 (serialization spike), [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md) (attempt-after-recovery). [pass 1]

## Landing decisions

### PD1 — Doc with tags

Every row keeps its [S]/[Doc]/[U] tag. [pass 1]

### PD2 — Each [U] has a test owner

B1 → [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 1; B2 → [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md). [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, layout, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE0_P0.3_DBOS_FIT_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD2: leave [U] in prose — never closed | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
