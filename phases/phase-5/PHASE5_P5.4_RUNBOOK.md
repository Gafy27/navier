# P5.4 Cutover runbook (runner and authz): ordered steps with checks, metrics and abort criteria; runner first, authz second; retirement last

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md)–[P5.3](PHASE5_P5.3_ROLLBACK_COMPAT.md), [P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md), [Phase 6](../phase-6/README.md).
Program: [`PHASE5_P5.4_RUNBOOK_PROGRAM.md`](PHASE5_P5.4_RUNBOOK_PROGRAM.md). Review: [`reviews/PHASE5_P5.4_RUNBOOK_REVIEW.md`](reviews/PHASE5_P5.4_RUNBOOK_REVIEW.md).
Sources: [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) audit; [P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md).

## Design explained

| # | Step | Check before next | Abort / rollback |
|---|------|-------------------|------------------|
| 1 | `DBOS.migrate` + authz-engine `provision()` on Navier's DB ([P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D3) | schemas present, grants per [P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md) | none needed |
| 2 | Deploy build with both runners, `RUNNER_DEFAULT=temporal` | harness green on staging | redeploy previous |
| 3 | Test org on DBOS | S1–S12 in prod, sweep closes 0 | flag back |
| 4 | Internal orgs, 1 week | stage gates ([P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) D2) | flag back |
| 5 | 10 % of orgs, 1 week | stage gates | flag back |
| 6 | `RUNNER_DEFAULT=dbos` | stage gates | flag back |
| 7 | Drain Temporal | drain count 0 for 14 days ([P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md) D4) | — |
| 8 | Authz export/import per org ([P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) D1) | counts match; markings parity (blocked by [P4.2](../phase-4/PHASE4_P4.2_NAVIER_MODEL.md) B1) | re-import |
| 9 | Authz shadow per org | 7 days zero unexplained diffs | mode back |
| 10 | `engine-shadow`, then `engine` | 7 days each | mode back |
| 11 | Retire Temporal ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4, owner sign-off) | drain 0, code guard ([P5.3](PHASE5_P5.3_ROLLBACK_COMPAT.md) D4) | — (deletion is revertible by git) |
| 12 | Remove gRPC client ([P4.5](../phase-4/PHASE4_P4.5_GRPC_REMOVAL.md)) | all orgs `engine` 14 days | — |

Runner before authz (D1) so one axis changes at a time; steps 8–10 may overlap step 7 per org (D2). Every step records who, when and the metric snapshot in the ops log (D3).

## Context and scope

Owner wants Temporal frozen, then gone; authz old client only until cutover.

## Goals and non-goals

**Goals**

- **G1 —** Each step has a check and a rollback.

**Non-goals**

- Automation of the runbook (later).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Steps | 12 | table | all units |
| Order | runner then authz | D1 | [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) D3 |
| Log | snapshots | ops log | [P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md) |

## Decisions and rationale

### D1 — Runner first, authz second

One axis at a time. [pass 1]

### D2 — Authz may overlap the drain

Per org. [pass 1]

### D3 — Ops log per step

Metric snapshot. [pass 1]

## Relevant cross-cutting concerns

Owner sign-off at step 11.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE5_P5.4_RUNBOOK_REVIEW.md#round-1) — VERDICT ready. | D1: authz first — authz changes checks inside the old runner too, doubling test matrix | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
