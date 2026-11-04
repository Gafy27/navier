# P5.1 Drain and dual-run — program design

Status: BINDING through pass 1
Architecture: [`PHASE5_P5.1_DRAIN_DUALRUN.md`](PHASE5_P5.1_DRAIN_DUALRUN.md) (BINDING through pass 2).
Depends on: [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md) architecture.
Tickets: [`PHASE5_P5.1_DRAIN_DUALRUN_TICKETS.md`](PHASE5_P5.1_DRAIN_DUALRUN_TICKETS.md). Review: [`reviews/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM_REVIEW.md`](reviews/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Filter in the two list queries](#pd1--filter-in-the-two-list-queries) |
| PD2 | [Drain metric](#pd2--drain-metric) |

## Implementation explained

One `NOT EXISTS (select 1 from dbos.workflow_status ...)` in `listStaleTurns` and `listEndedPauses` (PD1); a metric query exported for ops (PD2).

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D5 | `runner/temporal/reaper.ts` | filter |
| D4 | `runner/drain.ts` | query |

[pass 1]

## Landing decisions

### PD1 — Filter in the two list queries

No other reaper change. [pass 1]

### PD2 — Drain metric

Gauge per org. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: filter in recoverOne — lists still pay the cost | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
