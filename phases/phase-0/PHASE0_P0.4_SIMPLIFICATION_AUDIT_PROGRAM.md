# P0.4 Simplification audit of the machinery around the turn workflow — program design

Status: BINDING through pass 1
Architecture: [`PHASE0_P0.4_SIMPLIFICATION_AUDIT.md`](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) (BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04).
Depends on: [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) architecture.
Tickets: [`PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md`](PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md). Review: [`reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM_REVIEW.md`](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Table is the cleanup checklist](#pd1--table-is-the-cleanup-checklist) |
| PD2 | [Verdicts change only by amendment](#pd2--verdicts-change-only-by-amendment) |

## Implementation explained

The table is the checklist [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) closes: a row is done when its owner ticket lands and the code path is gone or frozen (PD1). A row may only change verdict through an amending pass of this spec (PD2).

## Program layout and construction

```text
docs/runner/simplification.md
```

[pass 1]

## Call sites and integration

[Phase 2](../phase-2/README.md), [Phase 3](../phase-3/README.md), [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md). [pass 1]

## Landing decisions

### PD1 — Table is the cleanup checklist

Each row links its owner ticket; [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) ticks rows. [pass 1]

### PD2 — Verdicts change only by amendment

No ticket changes a verdict on its own. [pass 1]

## Unresolved questions and blockers

Architecture carries open findings R3-F1, R3-F2; this program does not resolve them and names the ticket that must stop and report if it hits one.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, layout, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: separate cleanup backlog — drifts from the audit | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
