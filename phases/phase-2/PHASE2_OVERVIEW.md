# Phase 2 overview — DBOS turn workflow

Condensed requirements. Sources: [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) mapping, [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) verdicts A1–A6, A9, A12–A14, A21; DBOS SDK 5.4.0 declarations; docs.dbos.dev (read 2026-11-04).

## Requirements

- R1. Same rows, statuses and deltas as the Temporal runner for every harness scenario ([P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md)).
- R2. No lost start, no double step row, no lost stop, no lost decision.
- R3. Stop aborts an in-flight model or tool call within ~1 s.
- R4. Pause waits durably until decision or expiry without a reaper.
- R5. Deploys never break in-flight workflows.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) | workflow, queue, determinism rules | all |
| [P2.2](PHASE2_P2.2_STEPS_RETRIES.md) | step configs, attempt source, parallel tools | [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) |
| [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md) | stop/interrupt/graceful | [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) |
| [P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md) | pause/approval/expiry | [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) |
| [P2.5](PHASE2_P2.5_EXACTLY_ONCE.md) | atomic start, exactly-once writes, versioning, replay-test replacement | [Phase 5](../phase-5/README.md), [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |
