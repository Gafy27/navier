# P7.2 Security review: dbos schema grants, ids-only payloads, Conductor stance, retention, authz roles

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md), [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md), [P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md).
Program: [`PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md`](PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md). Review: [`reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md`](reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md).
Sources: `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`.

## Design explained

**Roles (D1).** `navier_migrate` owns `dbos`, `authz` and Navier schemas and runs `DBOS.migrate` and `provision()`. `navier_app` (API and worker) gets EXECUTE on `dbos.enqueue_workflow` and `dbos.send_message` (`dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`, `dbos/dist/src/sysdb_migrations/internal/migrations.js:361-380`), SELECT on `dbos.workflow_status`, and the DML the executor needs on system tables. `navier_ops` read-only. Closes [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) R3-F2 at design level; the exact executor DML list is [U] until a staging run with `pg_stat_statements`.

**Payloads (D2).** Workflow inputs, outputs, step outputs, messages and events are ids and enums; a runtime assert in the workflow registration wrapper rejects strings over 128 chars or keys outside an allow-list (L2).

**Conductor (D3).** Not used. If adopted later, only metadata (ids, statuses) leaves the network, which D2 already guarantees.

**Retention (D4).** A maintenance workflow deletes terminal `dbos.workflow_status` rows older than 30 days (`DBOS` garbage-collection API [U]; fallback SQL delete by the migrate role). Navier rows keep their own retention.

**Authz (D5).** authz-engine's service role is used only by the migration/import job ([P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md)); the app uses tx-bound principals.

## Context and scope

No secrets or PII in DBOS system tables.

## Goals and non-goals

**Goals**

- **G1 —** Least privilege; no content in system tables.

**Non-goals**

- Pen test.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Roles | 3 | grants | D1 |
| Payload assert | L2 | runtime | [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) |
| Retention | 30 d | job | D4 |

## Decisions and rationale

### D1 — Three roles, app least privilege

EXECUTE on two functions. [pass 2]

### D2 — Payload assert

Ids-only. [pass 1]

### D3 — No Conductor

Metadata-only if ever. [pass 1]

### D4 — System-table retention

30 days. [pass 1]

### D5 — Service role only in migration

authz. [pass 1]

## Relevant cross-cutting concerns

Secrets never in DBOS config files in repo.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: app owns dbos schema — DDL from app role; D3: Conductor for recovery — external dependency for correctness | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
