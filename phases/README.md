# Phases — plan, status, decision log

This is the plan file (`paths.plan` in `factory/config.yaml`). It lists every phase, the status of every unit, the cross-phase documents, and the decisions the owner still has to make. Designs are written; **this repository holds no product code** — tickets apply to the Navier repository. Every unit is BINDING by owner request (pt151u, 2026-11-04), 5 of them with review findings still open.

## Phases

| Phase | Name | Objective | Units |
|-------|------|-----------|-------|
| [phase-0](phase-0/README.md) | Research and map | Map how one Navier turn runs today, what Temporal provides, what each piece of surrounding machinery is for, how DBOS covers each need, and give every piece a keep / replace-by-DBOS / delete / simplify verdict. | P0.1, P0.2, P0.3, P0.4 |
| [phase-1](phase-1/README.md) | Runner seam | Put one small `TurnRunner` interface between Navier's domain code and the runner, move every Temporal-specific file behind it unchanged and frozen, and prove both runners with one shared conformance harness. | P1.1, P1.2, P1.3, P1.4, P1.5 |
| [phase-2](phase-2/README.md) | DBOS turn workflow | Run one Navier turn as one DBOS workflow on the same Postgres: steps with retries and timeouts, stop and interrupt that abort the in-flight call, approvals that wait in `recv` with the pause deadline, and a start that commits with the rows. | P2.1, P2.2, P2.3, P2.4, P2.5 |
| [phase-3](phase-3/README.md) | Simplification | Delete or shrink, on the DBOS path, every piece of machinery the audit marked delete / replace / simplify: claims, the recovery table and reaper restarts, the pending-promotion start, Temporal schedules, the stream sweep, and the config and migrations that only served them — without touching tables. | P3.1, P3.2, P3.3, P3.4 |
| [phase-4](phase-4/README.md) | authz-engine | Replace Navier's gRPC `cosmos.authz.v1` client and everything that depends on it with the owner's authz-engine behind one `NavierAuthz` seam: a Navier model, transaction-bound identity in DBOS steps, a shadow-checked cutover with rollback, then removal of the old client. | P4.1, P4.2, P4.3, P4.4, P4.5 |
| [phase-5](phase-5/README.md) | Migration and cutover | Move new turns to DBOS org by org while in-flight Temporal turns drain on Temporal, with tables unchanged, a one-flag rollback for new turns, and a runbook that also sequences the authz cutover. | P5.1, P5.2, P5.3, P5.4 |
| [phase-6](phase-6/README.md) | Operations | Run the DBOS worker as a long-lived process outside Vercel with stable executor identity, bounded queues, OpenTelemetry, a failure-mode table, and load and chaos tests that close the latency questions left by phase 2. | P6.1, P6.2, P6.3, P6.4, P6.5 |
| [phase-7](phase-7/README.md) | Hardening, open-source readiness and cleanup | Replace the Temporal replay tests with a DBOS test matrix, close the security items deferred from phases 2–6, make Navier ready to publish (pluggable authz with authz-engine as default, license, quickstart, supported workflows), and delete what the migration made dead. | P7.1, P7.2, P7.3, P7.4 |

## Where the owner goals live

| Goal (root README) | Dedicated units |
|--------------------|-----------------|
| DBOS on the same Postgres as the runner | P0.3, phase-2 (P2.1–P2.5) |
| Temporal kept as a frozen second runner | P1.1, P1.3, P1.4, P5.1 |
| Minimum machinery around the turn workflow | P0.4 (audit table), phase-3 (P3.1–P3.4), P7.4 |
| Own ModelAdapter, no AI SDK in the runner | P0.1 note, P2.2 D5 |
| authz-engine replaces the gRPC authz | phase-4 (P4.1–P4.5) |
| Long-lived worker outside Vercel | P6.1, P6.2 |

## Status of every unit

Status is copied from each spec header. Rounds are independent spec-reviewer rounds (max 3). "unresolved" lists review findings accepted open by owner request.

| Unit | Title | Architecture | Arch rounds / final | Program | Prog rounds / final | Tickets |
|------|-------|--------------|---------------------|---------|---------------------|---------|
| P0.1 | [Current-state map of one agent turn](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md) | 2 / ready | [2](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md) |
| P0.2 | [Temporal inventory and what the machinery around it is for](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md) |
| P0.3 | [DBOS fit: each need mapped to a DBOS 5.4.0 API](phase-0/PHASE0_P0.3_DBOS_FIT.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-0/PHASE0_P0.3_DBOS_FIT_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.3_DBOS_FIT_TICKETS.md) |
| P0.4 | [Simplification audit of the machinery around the turn workflow](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) | BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04 | 3 / not-ready | [BINDING through pass 1](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md) |
| P1.1 | [Runner interface and runner-neutral steps](phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-1/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM.md) | 1 / ready | [4](phase-1/PHASE1_P1.1_RUNNER_INTERFACE_TICKETS.md) |
| P1.2 | [Port every runner call site to the interface](phase-1/PHASE1_P1.2_OPERATIONS_PORT.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-1/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md) | 2 / ready | [4](phase-1/PHASE1_P1.2_OPERATIONS_PORT_TICKETS.md) |
| P1.3 | [Temporal as a frozen adapter](phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 3](phase-1/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM.md) | 3 / ready | [4](phase-1/PHASE1_P1.3_TEMPORAL_FREEZE_TICKETS.md) |
| P1.4 | [Runner configuration and selection](phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 1](phase-1/PHASE1_P1.4_RUNNER_CONFIG_PROGRAM.md) | 1 / ready | [2](phase-1/PHASE1_P1.4_RUNNER_CONFIG_TICKETS.md) |
| P1.5 | [Shared runner conformance harness](phase-1/PHASE1_P1.5_SHARED_HARNESS.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-1/PHASE1_P1.5_SHARED_HARNESS_PROGRAM.md) | 1 / ready | [4](phase-1/PHASE1_P1.5_SHARED_HARNESS_TICKETS.md) |
| P2.1 | [The DBOS turn workflow](phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 2](phase-2/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md) | 2 / ready | [4](phase-2/PHASE2_P2.1_TURN_WORKFLOW_TICKETS.md) |
| P2.2 | [Steps, retries, timeouts and the attempt source](phase-2/PHASE2_P2.2_STEPS_RETRIES.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-2/PHASE2_P2.2_STEPS_RETRIES_PROGRAM.md) | 1 / ready | [4](phase-2/PHASE2_P2.2_STEPS_RETRIES_TICKETS.md) |
| P2.3 | [Stop, interrupt and graceful stop on DBOS](phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) | BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04 | 3 / not-ready | [BINDING through pass 1](phase-2/PHASE2_P2.3_STOP_INTERRUPT_PROGRAM.md) | 1 / ready | [4](phase-2/PHASE2_P2.3_STOP_INTERRUPT_TICKETS.md) |
| P2.4 | [Approval and pause as a durable wait](phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-2/PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM.md) | 1 / ready | [3](phase-2/PHASE2_P2.4_APPROVAL_PAUSE_TICKETS.md) |
| P2.5 | [Atomic start, exactly-once writes, versioning and the replay-test replacement](phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) | BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04 | 3 / not-ready | [BINDING through pass 2](phase-2/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md) | 2 / ready | [4](phase-2/PHASE2_P2.5_EXACTLY_ONCE_TICKETS.md) |
| P3.1 | [Claims and recovery off the DBOS path](phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-3/PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM.md) | 1 / ready | [3](phase-3/PHASE3_P3.1_CLAIMS_RECOVERY_TICKETS.md) |
| P3.2 | [Pending messages and promotion without a lost start](phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-3/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md) | 2 / ready | [3](phase-3/PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md) |
| P3.3 | [Schedules: the turn audit sweep and the stream sweep](phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM.md) | 1 / ready | [3](phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS_TICKETS.md) |
| P3.4 | [Schema and config inventory after simplification](phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM.md) | 2 / ready | [2](phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS_TICKETS.md) |
| P4.1 | [Authz seam and call-site inventory](phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-4/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md) | 1 / ready | [5](phase-4/PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md) |
| P4.2 | [Navier as an authz-engine model](phase-4/PHASE4_P4.2_NAVIER_MODEL.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-4/PHASE4_P4.2_NAVIER_MODEL_PROGRAM.md) | 1 / ready | [3](phase-4/PHASE4_P4.2_NAVIER_MODEL_TICKETS.md) |
| P4.3 | [Identity propagation and checks inside DBOS steps](phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 2](phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md) | 2 / ready | [4](phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md) |
| P4.4 | [Migration and cutover from the old authz service](phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04](phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md) | 3 / not-ready | [5](phase-4/PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md) |
| P4.5 | [Removal of the old gRPC authz client](phase-4/PHASE4_P4.5_GRPC_REMOVAL.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-4/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM.md) | 1 / ready | [3](phase-4/PHASE4_P4.5_GRPC_REMOVAL_TICKETS.md) |
| P5.1 | [Drain and dual-run](phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-5/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM.md) | 1 / ready | [3](phase-5/PHASE5_P5.1_DRAIN_DUALRUN_TICKETS.md) |
| P5.2 | [Rollout flags and order](phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-5/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM.md) | 2 / ready | [2](phase-5/PHASE5_P5.2_ROLLOUT_FLAGS_TICKETS.md) |
| P5.3 | [Rollback and compatibility](phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-5/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM.md) | 1 / ready | [2](phase-5/PHASE5_P5.3_ROLLBACK_COMPAT_TICKETS.md) |
| P5.4 | [Cutover runbook (runner and authz)](phase-5/PHASE5_P5.4_RUNBOOK.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 1](phase-5/PHASE5_P5.4_RUNBOOK_PROGRAM.md) | 1 / ready | [2](phase-5/PHASE5_P5.4_RUNBOOK_TICKETS.md) |
| P6.1 | [Worker deployment and lifecycle](phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) | BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04 | 3 / not-ready | [BINDING through pass 1](phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT_PROGRAM.md) | 1 / ready | [4](phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT_TICKETS.md) |
| P6.2 | [Queues, partitions and sizing](phase-6/PHASE6_P6.2_SCALING_QUEUES.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-6/PHASE6_P6.2_SCALING_QUEUES_PROGRAM.md) | 1 / ready | [2](phase-6/PHASE6_P6.2_SCALING_QUEUES_TICKETS.md) |
| P6.3 | [Traces, metrics and alerts](phase-6/PHASE6_P6.3_OBSERVABILITY.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-6/PHASE6_P6.3_OBSERVABILITY_PROGRAM.md) | 2 / ready | [3](phase-6/PHASE6_P6.3_OBSERVABILITY_TICKETS.md) |
| P6.4 | [Failure-mode table](phase-6/PHASE6_P6.4_FAILURE_MODES.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-6/PHASE6_P6.4_FAILURE_MODES_PROGRAM.md) | 1 / ready | [2](phase-6/PHASE6_P6.4_FAILURE_MODES_TICKETS.md) |
| P6.5 | [Load and chaos tests](phase-6/PHASE6_P6.5_LOAD_CHAOS.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-6/PHASE6_P6.5_LOAD_CHAOS_PROGRAM.md) | 1 / ready | [3](phase-6/PHASE6_P6.5_LOAD_CHAOS_TICKETS.md) |
| P7.1 | [DBOS test matrix](phase-7/PHASE7_P7.1_TEST_MATRIX.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-7/PHASE7_P7.1_TEST_MATRIX_PROGRAM.md) | 1 / ready | [3](phase-7/PHASE7_P7.1_TEST_MATRIX_TICKETS.md) |
| P7.2 | [Security review](phase-7/PHASE7_P7.2_SECURITY_REVIEW.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 3](phase-7/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md) | 3 / ready | [4](phase-7/PHASE7_P7.2_SECURITY_REVIEW_TICKETS.md) |
| P7.3 | [Open-source readiness](phase-7/PHASE7_P7.3_OSS_READINESS.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-7/PHASE7_P7.3_OSS_READINESS_PROGRAM.md) | 1 / ready | [4](phase-7/PHASE7_P7.3_OSS_READINESS_TICKETS.md) |
| P7.4 | [Temporal retirement and dead-code removal](phase-7/PHASE7_P7.4_DEAD_CODE.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-7/PHASE7_P7.4_DEAD_CODE_PROGRAM.md) | 1 / ready | [4](phase-7/PHASE7_P7.4_DEAD_CODE_TICKETS.md) |

## BINDING with unresolved findings

- **P0.4 Simplification audit of the machinery around the turn workflow**: architecture R3-F1, R3-F2 — see `phase-0/reviews/`.
- **P2.3 Stop, interrupt and graceful stop on DBOS**: architecture R3-F1, R3-F2 — see `phase-2/reviews/`.
- **P2.5 Atomic start, exactly-once writes, versioning and the replay-test replacement**: architecture R3-F1, R3-F2 — see `phase-2/reviews/`.
- **P4.4 Migration and cutover from the old authz service**: program R3-F1, R3-F2 — see `phase-4/reviews/`.
- **P6.1 Worker deployment and lifecycle**: architecture R3-F1, R3-F2 — see `phase-6/reviews/`.

## Cross-phase documents

- Product contract: [`../README.md`](../README.md).
- Project profile (stack, layering, testing, tickets): [`../factory/profile/navier_dbos/README.md`](../factory/profile/navier_dbos/README.md).
- Factory config: [`../factory/config.yaml`](../factory/config.yaml).
- Source trees (cited `tree/path:a-b`, every range checked by the validator): navier `/workspace/attach/navier/src` @ `zip 2026-11-04` (owner code, read-only); dbos `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` @ `5.4.0` (MIT); proto `/workspace/dbos-agent` @ `no-vcs` (owner prototype); aze `/workspace/authz-engine` @ `design 2026-11-03` (owner design). Each phase has `indexing/`.
- Current-state map and Temporal inventory: [P0.1](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md), [P0.2](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md); simplification audit table: [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).

## Gates for owner

Every D and PD pick was delegated to the designer (request pt151u) and recorded as "recommend-A". **The owner has not answered any of them.** Owner decisions already given (DBOS only maintained runner, frozen Temporal, no AI SDK, keep delta table + SSE hub, worker outside Vercel, keep tables and drain, authz-engine) are not gates. The most consequential picks, per phase:

**Phase 0 — Research and map**

- [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D1 — minimum rule: delete every piece whose only job is to cover a Temporal gap DBOS closes, keep product behaviour (A) vs port the Temporal machinery 1:1 onto DBOS first and simplify later (B).
- [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D3 — per-agent-version `maxRecoveries` becomes one global `maxRecoveryAttempts` on the turn workflow, enforced per version only by the audit sweep (A) vs keep per-version restarts in an app-level table (B).
- [P0.3](phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 — DBOS system schema lives in the same Postgres database as Navier (schema `dbos`) so starts and messages commit with Navier rows (A) vs a separate system database (B).

**Phase 1 — Runner seam**

- [P1.1](phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4 — a turn belongs to DBOS iff `dbos.workflow_status` has its workflow id; no new column (A) vs a `runner` column on the agent message (B).
- [P1.3](phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4 — retire Temporal when no non-terminal Temporal turn exists for 14 days and the owner signs off (A) vs keep the adapter indefinitely as a supported fallback (B).
- [P1.5](phase-1/PHASE1_P1.5_SHARED_HARNESS.md) D1 — one conformance suite asserting only rows, run on both runners (A) vs separate per-runner suites (B).

**Phase 2 — DBOS turn workflow**

- [P2.1](phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) D2 — queue `turns` partitioned by thread with `partitionConcurrency: 1` (A) vs no queue, direct start (B).
- [P2.3](phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) D1 — stop = `stop_requested` row + `dbos.send_message` + `NOTIFY` to a worker abort hub, all in the API transaction (A) vs `DBOS.cancelWorkflow` (B) vs worker polling only (C).
- [P2.4](phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) D1 — a paused turn keeps its workflow alive in `recv` until the decision or `expires_at` (A) vs end the workflow and start a new one with a suffixed id on decide (B).
- [P2.5](phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D1 — start by `SELECT dbos.enqueue_workflow(...)` inside the post transaction (A) vs `DBOSClient.enqueueInTransaction` (B) vs enqueue after commit + audit sweep (C).
- [P2.5](phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D7 — steps keep Navier's own `withTransaction` (A) vs DBOS `KyselyDataSource` transactions for finish/pause (B).

**Phase 3 — Simplification**

- [P3.1](phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) D2 — global `maxRecoveryAttempts` 3 on the workflow, per-version lower limits enforced by the audit sweep from `recoveryAttempts` (A) vs per-version caps through one registration per limit value (B).
- [P3.2](phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) D1 — enqueue the promoted turn inside `closeTurn`'s transaction by SQL (A) vs enqueue from workflow code after the finish step (B).
- [P3.3](phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) D1 — one scheduled turn audit sweep (every minute) replaces the reaper on the DBOS path (A) vs no sweep at all (B).
- [P3.4](phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D2 — leave `step_claim` and `recovery` tables in place, unused by DBOS, until Temporal retires (A) vs drop them at cutover (B).

**Phase 4 — authz-engine**

- [P4.1](phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) D1 — an intent-level `NavierAuthz` seam (checks, writes, reads named in Navier terms) with authz-engine as the default implementation (A) vs calling the authz-engine SDK directly at every call site (B).
- [P4.1](phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) D5 — stop writing the `agent_principal` row; the agent principal is the authz-engine subject `agent:<org>~<id>` (A) vs keep the row as a second source (B).
- [P4.2](phase-4/PHASE4_P4.2_NAVIER_MODEL.md) D4 — approvals stay Navier rows (`action_decision`, `approval_memory`); authz-engine decides who may decide (A) vs approvals as expiring grants (B).
- [P4.3](phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md) D2 — authz-engine installed in Navier's Postgres (schema `authz`) and checked inside the step's own transaction (A) vs a separate authz database (B).
- [P4.4](phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) D2 — shadow mode: legacy decides, engine evaluated in parallel, flip per org after 7 days with zero diffs, reverse shadow for rollback (A) vs direct cutover (B).

**Phase 5 — Migration and cutover**

- [P5.1](phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md) D2 — drain only: Temporal turns (including paused ones) finish on Temporal; nothing is moved (A) vs re-enqueue paused Temporal turns on DBOS (B).
- [P5.2](phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) D1 — per-org rollout with `RUNNER_TEMPORAL_ORGS` as the list of orgs still on Temporal, internal orgs first (A) vs global switch (B).
- [P5.3](phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md) D2 — rollback flips new turns back to Temporal; DBOS-started turns finish on DBOS (A) vs stop DBOS workers on rollback (B).

**Phase 6 — Operations**

- [P6.1](phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) D2 — stable executor IDs per worker slot (StatefulSet-style ordinal) so a restarted slot recovers its own workflows (A) vs DBOS Conductor-driven recovery (B).
- [P6.2](phase-6/PHASE6_P6.2_SCALING_QUEUES.md) D1 — one `turns` queue partitioned by thread with `partitionConcurrency: 1` and `workerConcurrency` sized per pod (A) vs one queue per org (B).
- [P6.3](phase-6/PHASE6_P6.3_OBSERVABILITY.md) D1 — DBOS OTLP traces with `workflowAttributes` {org, traceId} plus Navier pino logs unchanged (A) vs a custom tracing wrapper (B).

**Phase 7 — Hardening, open-source readiness and cleanup**

- [P7.3](phase-7/PHASE7_P7.3_OSS_READINESS.md) D2 — license: Apache-2.0 for Navier, matching authz-engine and compatible with the MIT DBOS SDK (A) vs MIT (B).
- [P7.3](phase-7/PHASE7_P7.3_OSS_READINESS.md) D1 — authz is pluggable through `NavierAuthz` with authz-engine as the default and only bundled adapter; other adapters must pass the conformance suite (A) vs bundle a second adapter (B).
- [P7.4](phase-7/PHASE7_P7.4_DEAD_CODE.md) D3 — after retirement, stop writing `step_claim` and `recovery` and keep the tables read-only until the owner approves a drop (A) vs drop them in the retirement release (B).
- [P7.2](phase-7/PHASE7_P7.2_SECURITY_REVIEW.md) D1 — application role gets only EXECUTE on `dbos.enqueue_workflow` and `dbos.send_message` plus SELECT on `dbos.workflow_status`; DDL only for the migration role (A) vs application role owns the `dbos` schema (B).

## Decision log

| Date | Decision | Picked by | Status |
|------|----------|-----------|--------|
| 2026-11-04 | Design-only project; phases 0–7, 36 units, three artifacts each | owner request (pt151u) | recorded |
| 2026-11-04 | DBOS is the only maintained runner; Temporal frozen behind the runner seam (compiles, passes its tests, no new work) | owner | recorded |
| 2026-11-04 | No Vercel AI SDK in the runner; `llm/` ModelAdapter unchanged | owner (pt151u) | recorded |
| 2026-11-04 | Keep Postgres delta table + SSE hub; worker long-lived outside Vercel; keep tables, drain Temporal | owner | recorded |
| 2026-11-04 | Replace identity/authz* and the cosmos.authz.v1 gRPC client with authz-engine (new phase 4); authz pluggable in open source | owner (follow-up) | recorded |
| 2026-11-04 | Every unit BINDING after at most 3 review rounds; not-ready after round 3 recorded as BINDING with unresolved findings | owner request (pt151u) | recorded |
| 2026-11-04 | [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D1 — minimum rule: delete every piece whose only job is to cover a Temporal gap DBOS closes, keep product behaviour (A) vs port the Temporal machinery 1:1 onto DBOS first and simplify later (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D3 — per-agent-version `maxRecoveries` becomes one global `maxRecoveryAttempts` on the turn workflow, enforced per version only by the audit sweep (A) vs keep per-version restarts in an app-level table (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P0.3](phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 — DBOS system schema lives in the same Postgres database as Navier (schema `dbos`) so starts and messages commit with Navier rows (A) vs a separate system database (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P1.1](phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4 — a turn belongs to DBOS iff `dbos.workflow_status` has its workflow id; no new column (A) vs a `runner` column on the agent message (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P1.3](phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4 — retire Temporal when no non-terminal Temporal turn exists for 14 days and the owner signs off (A) vs keep the adapter indefinitely as a supported fallback (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P1.5](phase-1/PHASE1_P1.5_SHARED_HARNESS.md) D1 — one conformance suite asserting only rows, run on both runners (A) vs separate per-runner suites (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P2.1](phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) D2 — queue `turns` partitioned by thread with `partitionConcurrency: 1` (A) vs no queue, direct start (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P2.3](phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) D1 — stop = `stop_requested` row + `dbos.send_message` + `NOTIFY` to a worker abort hub, all in the API transaction (A) vs `DBOS.cancelWorkflow` (B) vs worker polling only (C). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P2.4](phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) D1 — a paused turn keeps its workflow alive in `recv` until the decision or `expires_at` (A) vs end the workflow and start a new one with a suffixed id on decide (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P2.5](phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D1 — start by `SELECT dbos.enqueue_workflow(...)` inside the post transaction (A) vs `DBOSClient.enqueueInTransaction` (B) vs enqueue after commit + audit sweep (C). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P2.5](phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D7 — steps keep Navier's own `withTransaction` (A) vs DBOS `KyselyDataSource` transactions for finish/pause (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P3.1](phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) D2 — global `maxRecoveryAttempts` 3 on the workflow, per-version lower limits enforced by the audit sweep from `recoveryAttempts` (A) vs per-version caps through one registration per limit value (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P3.2](phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) D1 — enqueue the promoted turn inside `closeTurn`'s transaction by SQL (A) vs enqueue from workflow code after the finish step (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P3.3](phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) D1 — one scheduled turn audit sweep (every minute) replaces the reaper on the DBOS path (A) vs no sweep at all (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P3.4](phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D2 — leave `step_claim` and `recovery` tables in place, unused by DBOS, until Temporal retires (A) vs drop them at cutover (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P4.1](phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) D1 — an intent-level `NavierAuthz` seam (checks, writes, reads named in Navier terms) with authz-engine as the default implementation (A) vs calling the authz-engine SDK directly at every call site (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P4.1](phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) D5 — stop writing the `agent_principal` row; the agent principal is the authz-engine subject `agent:<org>~<id>` (A) vs keep the row as a second source (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P4.2](phase-4/PHASE4_P4.2_NAVIER_MODEL.md) D4 — approvals stay Navier rows (`action_decision`, `approval_memory`); authz-engine decides who may decide (A) vs approvals as expiring grants (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P4.3](phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md) D2 — authz-engine installed in Navier's Postgres (schema `authz`) and checked inside the step's own transaction (A) vs a separate authz database (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P4.4](phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) D2 — shadow mode: legacy decides, engine evaluated in parallel, flip per org after 7 days with zero diffs, reverse shadow for rollback (A) vs direct cutover (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P5.1](phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md) D2 — drain only: Temporal turns (including paused ones) finish on Temporal; nothing is moved (A) vs re-enqueue paused Temporal turns on DBOS (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P5.2](phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) D1 — per-org rollout with `RUNNER_TEMPORAL_ORGS` as the list of orgs still on Temporal, internal orgs first (A) vs global switch (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P5.3](phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md) D2 — rollback flips new turns back to Temporal; DBOS-started turns finish on DBOS (A) vs stop DBOS workers on rollback (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P6.1](phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) D2 — stable executor IDs per worker slot (StatefulSet-style ordinal) so a restarted slot recovers its own workflows (A) vs DBOS Conductor-driven recovery (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P6.2](phase-6/PHASE6_P6.2_SCALING_QUEUES.md) D1 — one `turns` queue partitioned by thread with `partitionConcurrency: 1` and `workerConcurrency` sized per pod (A) vs one queue per org (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P6.3](phase-6/PHASE6_P6.3_OBSERVABILITY.md) D1 — DBOS OTLP traces with `workflowAttributes` {org, traceId} plus Navier pino logs unchanged (A) vs a custom tracing wrapper (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P7.3](phase-7/PHASE7_P7.3_OSS_READINESS.md) D2 — license: Apache-2.0 for Navier, matching authz-engine and compatible with the MIT DBOS SDK (A) vs MIT (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P7.3](phase-7/PHASE7_P7.3_OSS_READINESS.md) D1 — authz is pluggable through `NavierAuthz` with authz-engine as the default and only bundled adapter; other adapters must pass the conformance suite (A) vs bundle a second adapter (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P7.4](phase-7/PHASE7_P7.4_DEAD_CODE.md) D3 — after retirement, stop writing `step_claim` and `recovery` and keep the tables read-only until the owner approves a drop (A) vs drop them in the retirement release (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P7.2](phase-7/PHASE7_P7.2_SECURITY_REVIEW.md) D1 — application role gets only EXECUTE on `dbos.enqueue_workflow` and `dbos.send_message` plus SELECT on `dbos.workflow_status`; DDL only for the migration role (A) vs application role owns the `dbos` schema (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
