# P7.3 Open-source readiness: pluggable authz (authz-engine default), Apache-2.0 proposal, quickstart, supported workflows, docs list

Status: BINDING through pass 3
Depends on: product contract [`README.md`](../../README.md); [P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md), [P4.5](../phase-4/PHASE4_P4.5_GRPC_REMOVAL.md), [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md), [P7.2](PHASE7_P7.2_SECURITY_REVIEW.md).
Program: [`PHASE7_P7.3_OSS_READINESS_PROGRAM.md`](PHASE7_P7.3_OSS_READINESS_PROGRAM.md). Review: [`reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md`](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md).
Sources: research [oss-inputs](indexing/oss-inputs.md).

## Design explained

**Pluggable authz (D1).** The `NavierAuthz` seam ([P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md)) is a public interface. The default and only bundled adapter is authz-engine on the same Postgres ([P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md)). A third-party adapter must pass `navier-authz-conformance` (the [P4.2](../phase-4/PHASE4_P4.2_NAVIER_MODEL.md) model scenarios: acting-for intersection, tool invoke, approvals, scopes) and keep fail-closed. There is no allow-all adapter; development uses authz-engine with a seed model.

**License (D2).** Apache-2.0 proposed, matching authz-engine (`aze/phases/phase-0/PHASE0_P0.2_LICENSE_GOVERNANCE.md:42-46`); DBOS SDK is MIT (`dbos/package.json:1-10`). Navier's current license is [U]; the gate is the owner's.

**Quickstart (D3).**
1. Start Postgres 16+.
2. `navier migrate` — Navier migrations, `DBOS.migrate`, authz-engine `provision()` ([P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md)).
3. `navier seed --org demo` — demo org, user, agent, model tuples.
4. `navier worker` — DBOS worker (long-lived).
5. `navier api` — HTTP + SSE.
6. Post a message with the SDK and stream the reply.
No Temporal, no gRPC authz service, no external queue.

**Supported workflows (D4).** Chat turn with streaming deltas; tool calls with retries and idempotency; human approval pause/resume; stop (cancel) and interrupt; pending message promotion; edit and retry of a message; scheduled sweeps. **Not supported:** Temporal as a maintained runner (frozen adapter, removed at retirement); Vercel AI SDK as runner (rejected, owner); workers on serverless platforms.

**Docs (D5).** README, quickstart, architecture (runner seam, DBOS turn workflow, authz seam), operations (deployment, failure modes, runbook), security (roles, payload rule), authz adapter guide, CONTRIBUTING, LICENSE/NOTICE.

## Context and scope

Gabriel's open-source plan.

## Goals and non-goals

**Goals**

- **G1 —** A stranger runs Navier on one Postgres in 10 minutes.

**Non-goals**

- Governance model (later).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Authz plug | seam + conformance | adapters | [P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) |
| License | Apache-2.0 | gate | [oss-inputs](indexing/oss-inputs.md) |
| Quickstart | 6 steps | docs | [P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) |
| Workflows | supported list | docs | phases 2–3 |

## Decisions and rationale

### D1 — Pluggable authz, authz-engine default, conformance suite

No allow-all. [pass 2]

### D2 — Apache-2.0 proposal

Owner gate. [pass 1]

### D3 — Six-step quickstart on one Postgres

As listed. [pass 2]

### D4 — Supported workflows and non-goals

As listed. [pass 3]

### D5 — Docs set

As listed. [pass 1]

## Relevant cross-cutting concerns

Quickstart is a CI job.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D4, D5 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-1) — VERDICT not-ready. | D1: allow-all dev adapter — ships an unsafe default; D2: MIT — no patent grant | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-2) — VERDICT fix-then-ready. | — | [review round 1](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-1); new D3 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | D4 | Review fixes for R2-F1 ([round 2](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md#round-2); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
