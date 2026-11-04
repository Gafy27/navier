# P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API: need → DBOS API → evidence tag, plus the gaps DBOS leaves

Status: BINDING through pass 3
Depends on: product contract [`README.md`](../../README.md); [P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md).
Program: [`PHASE0_P0.3_DBOS_FIT_PROGRAM.md`](PHASE0_P0.3_DBOS_FIT_PROGRAM.md). Review: [`reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md`](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md).
Sources: research [dbos-sdk-surface](indexing/dbos-sdk-surface.md), [dbos-agent-prototype](indexing/dbos-agent-prototype.md); docs.dbos.dev (read 2026-11-04, `[Doc]`).

## Design explained

**Mapping (D1).**

| Need | DBOS 5.4.0 | Evidence |
|------|------------|----------|
| T1 durable steps + retry | `DBOS.registerWorkflow`, `DBOS.runStep` with `retriesAllowed`, `maxAttempts`, `intervalSeconds`, `backoffRate`, step timeout | [S] `dbos/dist/src/dbos.d.ts:663-701`, `dbos/dist/src/step.d.ts:5-26` |
| T2 signals | `DBOS.send(id, msg, topic, idempotencyKey)` / `DBOS.recv(topic, {timeoutSeconds, deadlineEpochMS})`; SQL `dbos.send_message` | [S] `dbos/dist/src/dbos.d.ts:570-583`, `dbos/dist/src/sysdb_migrations/internal/migrations.js:361-380` |
| T3 cancellation | `cancelWorkflow` stops at the next step and runs no more code [Doc]; in-step abort is a **gap** (D4) | [S] `dbos/dist/src/dbos.d.ts:376` |
| T4 continue-as-new | not needed: no history-length limit [Doc]; steps bounded by `maxSteps` | [Doc] |
| T5 id conflict/reuse | workflow id is the idempotency key; `workflowIDReusePolicy` `return-existing`/`reject`; ids are never reused (gap for restart-after-pause, D4) | [S] `dbos/dist/src/dbos.d.ts:28-43` |
| T6 search attribute | `workflowAttributes` on start; `listWorkflows` filters | [S] `dbos/dist/src/dbos.d.ts:28-43`, `dbos/dist/src/dbos.d.ts:340` |
| T7 schedules | `DBOS.applySchedules` | [S] `dbos/dist/src/dbos.d.ts:792` |
| T8 tracing | built-in OpenTelemetry (`enableOTLP`, `otlpTracesEndpoints`) | [S] `dbos/dist/src/dbos-executor.d.ts:39-54` |
| T9 attempt | `DBOS.stepStatus.currentAttempt` — counts within one execution; resets after recovery [U] (D4) | [S] `dbos/dist/src/dbos.d.ts:276` |
| T10 replay tests | none; replaced by recovery/fork tests and patch discipline ([P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md)) | [S] `patch` `dbos/dist/src/dbos.d.ts:718-728` |
| T11 probe | system-database query | [Doc] |
| T12 worker | long-lived process `DBOS.launch()`, `DBOS.shutdown({workflowCompletionTimeoutMS})` | [S] `dbos/dist/src/dbos.d.ts:248`, `proto/src/worker.ts:1-10` |
| T13 result | `retrieveWorkflow(id).getResult()`, `getEvent` | [S] `dbos/dist/src/dbos.d.ts:607` |
| M1 lost start | enqueue inside the Navier transaction: SQL `dbos.enqueue_workflow` or `DBOSClient.enqueueInTransaction` | [S] `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`, `dbos/dist/src/client.d.ts:122-136` |
| M2 restart cap | `maxRecoveryAttempts` (default 100) → status `MAX_RECOVERY_ATTEMPTS_EXCEEDED` | [S] `dbos/dist/src/workflow.d.ts:30-57`, `dbos/dist/src/workflow.d.ts:148-164` |
| M3 pause expiry | `recv` with `deadlineEpochMS` inside the still-running workflow | [S] `dbos/dist/src/dbos.d.ts:583`, prototype `proto/src/agent.ts:104-124` |
| M4 one model call per step | step checkpoint: a completed step is never re-run; a step interrupted mid-call **is** re-run (at-least-once) [Doc] | [Doc] |
| M8 queue per thread | queue with `partitionConcurrency: 1`, `queuePartitionKey` = thread | [S] `dbos/dist/src/wfqueue.d.ts:29-56`, `dbos/dist/src/system_database.d.ts:150-162` |

**Same database (D2).** The system schema `dbos` lives in Navier's Postgres database (`systemDatabaseUrl` = app URL, `systemDatabaseSchemaName` default `dbos`, `dbos/dist/src/dbos-executor.d.ts:16-30`). This is what lets a start or a message commit in the same transaction as Navier's rows.

**Recovery (D3).** Self-hosted without Conductor, a restarted process recovers the PENDING workflows of **its own executor id** [Doc]; dead executors' work is not picked up by others unless Conductor (enterprise) is used [Doc]. Executor ids must therefore be stable per worker slot ([P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)).

**Gaps (D4).** (a) No push into a running step: stop must abort the in-flight model call through Navier's own signal ([P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md)). (b) Step attempt numbers restart after recovery, so the tool-call "interrupted" rule must use a database-derived attempt ([P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md)). (c) Ids are never reused, so a paused turn keeps its workflow alive in `recv` instead of ending and restarting ([P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md)). `recv`'s default timeout is 60 s (`dbos/dist/src/dbos.d.ts:115-121`), so every wait passes an explicit deadline.

**Prototype (D5).** The owner's prototype ran the recv-wait approval and survived `kill -9` ([dbos-agent-prototype](indexing/dbos-agent-prototype.md)).

**Serialization of SQL enqueue (D6).** The SQL function stores arguments as `portable_json`; whether a TypeScript workflow registered with the default serializer decodes them is **[U]** and is the first test of [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md).

## Context and scope

DBOS 5.4.0 as installed by the owner; Conductor not assumed.

## Goals and non-goals

**Goals**

- **G1 —** Every need has an API or a named gap.
- **G2 —** Every claim carries [S], [Doc] or [U].

**Non-goals**

- Designing the workflow ([Phase 2](../phase-2/README.md)).
- Conductor adoption (gate in [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Mapping | T/M rows | API + tag | SDK .d.ts |
| Same DB | schema `dbos` | atomic start/message | migrations.js |
| Recovery | executor scope | stable ids | docs |
| Gaps | abort, attempt, id reuse | routed to phase 2 | D4 |

## Decisions and rationale

### D1 — Feature mapping with evidence tags

The table above. [pass 3]

### D2 — System schema in the same database

One Postgres database; DBOS schema `dbos` beside Navier tables. [pass 1]

### D3 — Executor-scoped recovery

Without Conductor, each worker recovers its own executor id; stable ids required. [pass 1]

### D4 — Three gaps and the recv default

In-step abort, attempt reset, id reuse; `recv` waits default 60 s, so pass deadlines. [pass 2]

### D5 — Prototype evidence

recv-wait approval verified by the owner. [pass 1]

### D6 — SQL-enqueue serialization is [U]

First test of [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md); fallback `enqueueInTransaction`. [pass 3]

## Unresolved questions and blockers

| Id | Assumption or unknown | Source or evidence gap | Affected decision / blocked work | Resolution needed |
|----|-----------------------|------------------------|----------------------------------|-------------------|
| B1 | `portable_json` args from SQL decode in a TS workflow | not run | [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D2 start atomicity | spike test in [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 1 [pass 3] |
| B2 | step attempt after recovery restarts at 1 | docs silent | [P2.2](../phase-2/PHASE2_P2.2_STEPS_RETRIES.md) D4 | kill test in [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md) [pass 1] |

## Relevant cross-cutting concerns

Security: everything written to `dbos.*` is visible to anyone with the system schema; inputs stay ids only ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) L2).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, B2 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-1) — VERDICT fix-then-ready. | D2: separate system database — loses atomic start and message; D3: assume any worker recovers any workflow — true only with Conductor | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D4 | Review fixes for R1-F1 ([round 1](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-2) — VERDICT fix-then-ready. | — | [review round 1](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-1) |
| 3 | 2026-11-04 | BINDING | D1 | Review fixes for R2-F1 ([round 2](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-3) — VERDICT ready. | D6: assume compatible — unverified | [review round 2](reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md#round-2); new D6, B1 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
