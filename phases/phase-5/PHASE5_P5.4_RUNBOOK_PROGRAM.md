# P5.4 Cutover runbook (runner and authz) — program design

Status: BINDING through pass 1
Architecture: [`PHASE5_P5.4_RUNBOOK.md`](PHASE5_P5.4_RUNBOOK.md) (BINDING through pass 1).
Depends on: [P5.4](PHASE5_P5.4_RUNBOOK.md) architecture.
Tickets: [`PHASE5_P5.4_RUNBOOK_TICKETS.md`](PHASE5_P5.4_RUNBOOK_TICKETS.md). Review: [`reviews/PHASE5_P5.4_RUNBOOK_PROGRAM_REVIEW.md`](reviews/PHASE5_P5.4_RUNBOOK_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| PD1 | [Runbook doc](#pd1--runbook-doc) |

## Implementation explained

The table becomes the operator runbook with commands per step (PD1).

## Program layout and construction

```text
docs/runner/cutover-runbook.md
```

[pass 1]

## Landing decisions

### PD1 — Runbook doc

Commands, queries, dashboards per step. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, layout | Initial program spec. Reviewed in [round 1](reviews/PHASE5_P5.4_RUNBOOK_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: wiki page — drifts from code | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
