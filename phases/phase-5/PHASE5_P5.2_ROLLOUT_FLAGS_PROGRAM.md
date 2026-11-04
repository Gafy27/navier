# P5.2 Rollout flags and order — program design

Status: BINDING through pass 2
Architecture: [`PHASE5_P5.2_ROLLOUT_FLAGS.md`](PHASE5_P5.2_ROLLOUT_FLAGS.md) (BINDING through pass 1).
Depends on: [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) architecture.
Tickets: [`PHASE5_P5.2_ROLLOUT_FLAGS_TICKETS.md`](PHASE5_P5.2_ROLLOUT_FLAGS_TICKETS.md). Review: [`reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md`](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| PD1 | [Precedence order](#pd1--precedence-order) |

## Implementation explained

Precedence: org in `RUNNER_TEMPORAL_ORGS` → Temporal; org in `RUNNER_DBOS_ORGS` → DBOS; else default (PD1).

## Landing decisions

### PD1 — Precedence order

Holdout list wins. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1 | Initial program spec. Reviewed in [round 1](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: allow-list wins — holdouts cannot be forced | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | PD1 | Review fixes for R1-F1 ([round 1](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready |
