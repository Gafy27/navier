# Phase 7 overview — Hardening, open-source readiness and cleanup

Condensed requirements. Sources: [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) audit (A21 replay tests, R3-F1 audit sweep), [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) deferred grants, [P4.5](../phase-4/PHASE4_P4.5_GRPC_REMOVAL.md), Gabriel's open-source plan.

## Requirements

- R1. A DBOS test matrix that covers what the replay tests guarded plus the new failure modes.
- R2. Security items: schema grants, ids-only payloads, Conductor stance, log retention, authz roles.
- R3. Open-source readiness: pluggable authz (authz-engine default), license, quickstart, supported workflows, docs list.
- R4. Dead code removed after retirement; the audit sweep re-judged.

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P7.1](PHASE7_P7.1_TEST_MATRIX.md) | test matrix | CI |
| [P7.2](PHASE7_P7.2_SECURITY_REVIEW.md) | security review | [P7.3](PHASE7_P7.3_OSS_READINESS.md) |
| [P7.3](PHASE7_P7.3_OSS_READINESS.md) | OSS readiness | owner, users |
| [P7.4](PHASE7_P7.4_DEAD_CODE.md) | deletion and re-judgement | owner |
