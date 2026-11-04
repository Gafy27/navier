# Phase 6 overview — Operations

Condensed requirements. Sources: owner decision 4, [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) deferred findings (abort latency, NOTIFY fan-out), [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) recovery budget.

## Requirements

- R1. Workers restart, scale and deploy without losing or duplicating turns.
- R2. Queue limits keep one thread serial and bound per-pod load.
- R3. Every turn is traceable from API request to model step.
- R4. Each failure mode has detection, impact and response.
- R5. Measured abort latency and NOTIFY fan-out under load.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P6.1](PHASE6_P6.1_WORKER_DEPLOYMENT.md) | deployment, identity, lifecycle | all |
| [P6.2](PHASE6_P6.2_SCALING_QUEUES.md) | queues, partitions, sizing | [P6.5](PHASE6_P6.5_LOAD_CHAOS.md) |
| [P6.3](PHASE6_P6.3_OBSERVABILITY.md) | traces, metrics, alerts | [P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md), [P6.4](PHASE6_P6.4_FAILURE_MODES.md) |
| [P6.4](PHASE6_P6.4_FAILURE_MODES.md) | failure-mode table | [P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md) |
| [P6.5](PHASE6_P6.5_LOAD_CHAOS.md) | load and chaos | [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |
