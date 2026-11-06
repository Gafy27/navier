# DBOS fit: each need mapped to a DBOS 5.4.0 API

Pin: DBOS 5.4.0 as installed by the owner; Conductor not assumed. `[S]` cites are `dbos/dist/src/<path>:<lines>` of the installed package, `proto/src/<path>` the owner's prototype. `[Doc]` is docs.dbos.dev read 2026-11-04.
Specs: [P0.3](../../phases/phase-0/PHASE0_P0.3_DBOS_FIT.md) (D1–D6), [program](../../phases/phase-0/PHASE0_P0.3_DBOS_FIT_PROGRAM.md) (PD1, PD2).
Needs T1–T13 are the Temporal features in [temporal-inventory.md](temporal-inventory.md); M1–M8 are Navier's own needs.

Tags (PD1): `[S]` source read, `[Doc]` documentation only, `[U]` unknown, each owned by a ticket in the last table (B1: P2.5 ticket 1, B2: P6.5).

## Mapping (D1)

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
| T9 attempt | `DBOS.stepStatus.currentAttempt` — counts within one execution; resets after recovery [U] (B2, owner [P6.5](../../phases/phase-6/PHASE6_P6.5_LOAD_CHAOS.md); D4) | [S] `dbos/dist/src/dbos.d.ts:276` |
| T10 replay tests | none; replaced by recovery/fork tests and patch discipline ([P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md)) | [S] `patch` `dbos/dist/src/dbos.d.ts:718-728` |
| T11 probe | system-database query | [Doc] |
| T12 worker | long-lived process `DBOS.launch()`, `DBOS.shutdown({workflowCompletionTimeoutMS})` | [S] `dbos/dist/src/dbos.d.ts:248`, `proto/src/worker.ts:1-10` |
| T13 result | `retrieveWorkflow(id).getResult()`, `getEvent` | [S] `dbos/dist/src/dbos.d.ts:607` |
| M1 lost start | enqueue inside the Navier transaction: SQL `dbos.enqueue_workflow` or `DBOSClient.enqueueInTransaction` | [S] `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`, `dbos/dist/src/client.d.ts:122-136` |
| M2 restart cap | `maxRecoveryAttempts` (default 100) → status `MAX_RECOVERY_ATTEMPTS_EXCEEDED` | [S] `dbos/dist/src/workflow.d.ts:30-57`, `dbos/dist/src/workflow.d.ts:148-164` |
| M3 pause expiry | `recv` with `deadlineEpochMS` inside the still-running workflow | [S] `dbos/dist/src/dbos.d.ts:583`, prototype `proto/src/agent.ts:104-124` |
| M4 one model call per step | step checkpoint: a completed step is never re-run; a step interrupted mid-call **is** re-run (at-least-once) [Doc] | [Doc] |
| M8 queue per thread | queue with `partitionConcurrency: 1`, `queuePartitionKey` = thread | [S] `dbos/dist/src/wfqueue.d.ts:29-56`, `dbos/dist/src/system_database.d.ts:150-162` |

## Same database (D2)

The system schema `dbos` lives in Navier's Postgres database (`systemDatabaseUrl` = app URL, `systemDatabaseSchemaName` default `dbos`, `dbos/dist/src/dbos-executor.d.ts:16-30`). A start or a message commits in the same transaction as Navier's rows.

## Recovery (D3)

Self-hosted without Conductor, a restarted process recovers the PENDING workflows of **its own executor id** [Doc]. Dead executors' work is not picked up by others unless Conductor (enterprise) is used [Doc]. Executor ids must be stable per worker slot ([P6.1](../../phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)).

## Gaps (D4)

- (a) No push into a running step: stop must abort the in-flight model call through Navier's own signal ([P2.3](../../phases/phase-2/PHASE2_P2.3_STOP_INTERRUPT.md)).
- (b) Step attempt numbers restart after recovery, so the tool-call "interrupted" rule must use a database-derived attempt ([P2.2](../../phases/phase-2/PHASE2_P2.2_STEPS_RETRIES.md)).
- (c) Ids are never reused, so a paused turn keeps its workflow alive in `recv` instead of ending and restarting ([P2.4](../../phases/phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md)).

`recv`'s default timeout is 60 s (`dbos/dist/src/dbos.d.ts:115-121`), so every wait passes an explicit deadline.

## Prototype (D5)

The owner's prototype ran the recv-wait approval and survived `kill -9` (`indexing/dbos-agent-prototype.md` in the P0.3 design).

## Serialization of SQL enqueue (D6)

The SQL function stores arguments as `portable_json`. Whether a TypeScript workflow registered with the default serializer decodes them is [U], owned by B1: first test of [P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 1. Fallback: `enqueueInTransaction`.

## Unknowns and test owners (PD2)

| Id | Unknown | Tag | Test owner |
|----|---------|-----|------------|
| B1 | `portable_json` args from SQL decode in a TS workflow | [U] | [P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) ticket 1 (serialization spike) |
| B2 | step attempt after recovery restarts at 1 (docs silent) | [U] | [P6.5](../../phases/phase-6/PHASE6_P6.5_LOAD_CHAOS.md) kill test (attempt-after-recovery) |

## Security

Everything written to `dbos.*` is visible to anyone with the system schema. Workflow inputs, step outputs, messages and events carry ids only ([P2.1](../../phases/phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) L2).
