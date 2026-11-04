# P5.2 Rollout flags and order: `RUNNER_DEFAULT=temporal` + `RUNNER_DBOS_ORGS` early, then `RUNNER_DEFAULT=dbos` + `RUNNER_TEMPORAL_ORGS` for holdouts

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md), [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md).
Program: [`PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM.md`](PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM.md). Review: [`reviews/PHASE5_P5.2_ROLLOUT_FLAGS_REVIEW.md`](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_REVIEW.md).
Sources: `navier/config.ts:11-46`.

## Design explained

**Flags (D1).** Stage 1: `RUNNER_DEFAULT=temporal`, `RUNNER_DBOS_ORGS=<list>` (orgs whose new turns start on DBOS). Stage 2: `RUNNER_DEFAULT=dbos`, `RUNNER_TEMPORAL_ORGS=<holdouts>` ([P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) D2). Flags are read per start; no restart needed if config reload is supported [U], else a rolling restart.

**Order (D2).** Test org → internal orgs (1 week) → 10 % of orgs (1 week) → all. Each stage needs: harness S1–S12 green on the deployed build; zero `MAX_RECOVERY_ATTEMPTS_EXCEEDED` turns not explained; p95 post→first delta within 20 % of Temporal for the same orgs; audit sweep closes < 0.1 % of turns.

**Authz (D3).** `AUTHZ_MODE` per org ([P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) D2) is independent; an org is never flipped on both axes in the same day.

## Context and scope

Orgs are the support unit.

## Goals and non-goals

**Goals**

- **G1 —** Each stage reversible by flag.

**Non-goals**

- Per-agent flags.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Flags | org lists | start runner | [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) |
| Stages | order + gates | go/no-go | metrics [P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md) |
| Authz axis | separate flag | no same-day flips | [P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md) |

## Decisions and rationale

### D1 — Two-stage flags

Allow-list then deny-list. [pass 1]

### D2 — Order and stage gates

As listed. [pass 1]

### D3 — One axis per org per day

Runner and authz separate. [pass 1]

## Relevant cross-cutting concerns

Flags never contain secrets.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE5_P5.2_ROLLOUT_FLAGS_REVIEW.md#round-1) — VERDICT ready. | D1: percent of turns — splits a thread across runners; D3: combined flip — ambiguous incidents | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
