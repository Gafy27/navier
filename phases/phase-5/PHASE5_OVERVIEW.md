# Phase 5 overview — Migration and cutover

Condensed requirements. Sources: [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) ownership rule, [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) config, [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) drain-window enqueue, [P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) authz flags.

## Requirements

- R1. New turns of a flipped org start on DBOS; existing turns end where they began.
- R2. Stop, decide and await reach the owning runner during the overlap.
- R3. Rollback of new turns by flag at any time before Temporal retires.
- R4. A runbook with checks, metrics and abort criteria per step.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md) | drain and dual-run rules | [P5.4](PHASE5_P5.4_RUNBOOK.md) |
| [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) | rollout flags and order | [P5.4](PHASE5_P5.4_RUNBOOK.md) |
| [P5.3](PHASE5_P5.3_ROLLBACK_COMPAT.md) | rollback and compatibility | [P5.4](PHASE5_P5.4_RUNBOOK.md) |
| [P5.4](PHASE5_P5.4_RUNBOOK.md) | runbook (runner + authz) | owner, operators |
