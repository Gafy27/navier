# Phase 3 overview — Simplification

Condensed requirements. Sources: [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) table rows A5–A12, A15–A18; [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) mapping; the DBOS SDK declarations.

## Requirements

- R1. On the DBOS path no code writes `step_claim` or `recovery`, and no reaper restart runs.
- R2. A promoted pending message starts atomically with the close that mints it.
- R3. One small scheduled sweep remains; it only closes rows whose workflow can no longer close them.
- R4. Config keys and migrations that served only Temporal compensations are marked Temporal-only.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md) | claims and recovery off the DBOS path | [P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md), [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) |
| [P3.2](PHASE3_P3.2_PENDING_PROMOTION.md) | pending promotion without the lost-start fallback | [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| [P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md) | turn audit sweep + stream sweep as DBOS schedules | [P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md) |
| [P3.4](PHASE3_P3.4_SCHEMA_MIGRATIONS.md) | schema and config inventory: what stays, what is Temporal-only | [P5.3](../phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md), [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) |
