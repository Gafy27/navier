# Phase 1 overview — Runner seam

Condensed requirements for the seam. Sources: [P0.1](../phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md) map, [P0.2](../phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md) inventory, [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) audit; call sites at the zip pin.

## Requirements

- R1. One interface for everything domain code asks of a runner: start (inside the caller's transaction), wake for stop, wake for decision, await the end, probe, close.
- R2. Domain step bodies are runner-neutral functions both runners call.
- R3. Temporal keeps working unchanged for the drain window, then can be deleted by removing one folder.
- R4. A suite proves both runners produce the same rows for the same scripted turn.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) | `TurnRunner`, `TurnSteps`, ownership rule | all later phases |
| [P1.2](PHASE1_P1.2_OPERATIONS_PORT.md) | every call site ported to the interface | [Phase 2](../phase-2/README.md) |
| [P1.3](PHASE1_P1.3_TEMPORAL_FREEZE.md) | `src/runner/temporal/` frozen adapter | [Phase 5](../phase-5/README.md), [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) |
| [P1.4](PHASE1_P1.4_RUNNER_CONFIG.md) | runner config and selection | [P5.2](../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) |
| [P1.5](PHASE1_P1.5_SHARED_HARNESS.md) | conformance harness | [Phase 2](../phase-2/README.md), [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |
