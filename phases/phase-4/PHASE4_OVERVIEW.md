# Phase 4 overview — authz-engine

Condensed requirements. Sources: Navier `identity/` and every call site at the zip pin; authz-engine README, phase-2 kernel (P2.4 identity, P2.5 writes/audit), phase-4 SDK (P4.1, P4.3 errors, P4.4 transactions), phase-5 enforcement (P5.2 agent guards), phase-6 agent template (P6.2).

## Requirements

- R1. One seam for everything Navier asks of authorization, with an inventory of every call site ([P4.1](PHASE4_P4.1_AUTHZ_SEAM.md)).
- R2. A Navier model in authz-engine: orgs, users, agents, threads, tools, approvals, scopes; agent principals and delegation where an agent acts only where agent and user both are allowed ([P4.2](PHASE4_P4.2_NAVIER_MODEL.md)).
- R3. Identity reaches DBOS steps from rows, never from workflow inputs; checks at tool call and approval run in the step's transaction on the same Postgres; writes are audited ([P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md)).
- R4. Data mapping, dual-check shadow mode and rollback ([P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md)).
- R5. The gRPC client, its config and generated code are deleted ([P4.5](PHASE4_P4.5_GRPC_REMOVAL.md)).
- R6. Open source: the seam is the plug point; authz-engine is the default ([P7.3](../phase-7/PHASE7_P7.3_OSS_READINESS.md)).

## Unit map

| Unit | Delivers | Used by |
|------|----------|---------|
| [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md) | `NavierAuthz` seam + call-site inventory | all |
| [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) | `navier.fga` model, tuple mapping, scenarios | [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md), [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) |
| [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md) | identity in steps, checks in tx, audit | [Phase 2](../phase-2/README.md) |
| [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) | export/import, shadow, flip, rollback | [Phase 5](../phase-5/README.md) |
| [P4.5](PHASE4_P4.5_GRPC_REMOVAL.md) | removal of the old client | [P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md) |
