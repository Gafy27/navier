# P1.4 Runner configuration and selection: `RUNNER_DEFAULT`, per-org override, DBOS settings, optional Temporal block

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md), [P1.2](PHASE1_P1.2_OPERATIONS_PORT.md).
Program: [`PHASE1_P1.4_RUNNER_CONFIG_PROGRAM.md`](PHASE1_P1.4_RUNNER_CONFIG_PROGRAM.md). Review: [`reviews/PHASE1_P1.4_RUNNER_CONFIG_REVIEW.md`](reviews/PHASE1_P1.4_RUNNER_CONFIG_REVIEW.md).
Sources: `navier/config.ts:11-46`; `dbos/dist/src/dbos-executor.d.ts:16-70`.

## Design explained

Config follows Navier's zod schemas (`navier/config.ts:11-46`) (D1):

| Key | Default | Meaning |
|-----|---------|---------|
| `RUNNER_DEFAULT` | `dbos` | runner for new turns |
| `RUNNER_TEMPORAL_ORGS` | empty | orgs whose new turns still start on Temporal (rollout lever, [P5.2](../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md)) |
| `DBOS_SYSTEM_DATABASE_URL` | = `DATABASE_URL` | must equal the app database ([P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) D2); boot fails otherwise |
| `DBOS_APP_VERSION` | build id | pinned application version ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md)) |
| `DBOS_EXECUTOR_ID` | required on workers | stable per worker slot ([P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)) |
| `TEMPORAL_*` | optional | present only while a Temporal turn may exist |

`forStart(org)` = Temporal if the org is listed, else `RUNNER_DEFAULT` (D2). `ownerOf` ignores config and looks at rows ([P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) D4). The worker constructs every configured runner; the API constructs DBOS (client-side only, never `launch`) and Temporal only if configured (D3). Boot refuses a DBOS URL different from the app URL (D4).

## Context and scope

`CoreConfig` and `TemporalConfigSchema` (`navier/config.ts:11-46`).

## Goals and non-goals

**Goals**

- **G1 —** One flag decides new turns; rows decide ownership.
- **G2 —** Removing Temporal deletes one schema block.

**Non-goals**

- Per-agent runner choice.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Schema | keys | zod | config.ts |
| Selection | `forStart` | org list | [P5.2](../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) |
| Boot check | same DB | refuse | [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 |

## Decisions and rationale

### D1 — Config keys

As tabled. [pass 1]

### D2 — Org override list

Rollout lever during the drain. [pass 1]

### D3 — Process roles

Worker: launch DBOS + Temporal worker if configured; API: enqueue/send only. [pass 1]

### D4 — Same-database check at boot

Compare host/db of both URLs. [pass 1]

## Relevant cross-cutting concerns

Secrets: URLs never logged ([P7.2](../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE1_P1.4_RUNNER_CONFIG_REVIEW.md#round-1) — VERDICT ready. | D2: percentage rollout — orgs are the unit of support; D4: trust config — silent loss of atomic start | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
