# P6.3 Traces, metrics and alerts — program design

Status: BINDING through pass 2
Architecture: [`PHASE6_P6.3_OBSERVABILITY.md`](PHASE6_P6.3_OBSERVABILITY.md) (BINDING through pass 1).
Depends on: [P6.3](PHASE6_P6.3_OBSERVABILITY.md) architecture.
Tickets: [`PHASE6_P6.3_OBSERVABILITY_TICKETS.md`](PHASE6_P6.3_OBSERVABILITY_TICKETS.md). Review: [`reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md`](reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Metrics queries module](#pd1--metrics-queries-module) |

## Implementation explained

One module of read-only queries feeding existing metrics export [U: Navier has no metrics exporter in `src`] (PD1).

## Landing decisions

### PD1 — Metrics queries module

Read-only role. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1 | Initial program spec. Reviewed in [round 1](reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: Conductor dashboard — external dependency | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | PD1 | Review fixes for R1-F1 ([round 1](reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE6_P6.3_OBSERVABILITY_PROGRAM_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready |
