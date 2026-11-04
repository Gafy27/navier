# DBOS Transact TS 5.4.0 API surface used by the design

**Kind:** module
**Source:** `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` (@dbos-inc/dbos-sdk 5.4.0 as installed, MIT, pin `5.4.0`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P0.3 fit, phase 2, phase 6
**Verdict axis:** live
**Status:** ready

**Question:** Which DBOS 5.4.0 APIs exist for steps, messages, events, queues, schedules, versioning, recovery and shutdown, and with which options?

## Answer in plain language

Workflows are registered functions; `runStep` takes retry options (`retriesAllowed`, `intervalSeconds`, `maxAttempts`, `backoffRate`) and a step timeout; `stepStatus` exposes the attempt and abort signals. `send`/`recv` give durable messages with topic and idempotency key, `recv` waits up to a timeout or deadline; `setEvent`/`getEvent` publish values. Queues take worker, global and per-partition concurrency and rate limits; enqueue options carry a partition key and a deduplication id. Schedules are applied declaratively. Workflows carry `maxRecoveryAttempts`, `patch`/`deprecatePatch` and an application version. The system database installs SQL functions `enqueue_workflow` and `send_message` usable from any transaction. `DBOSClient.enqueueInTransaction` enqueues inside a caller-owned transaction.

## Why it matters for this project

These are the building blocks the turn workflow needs; the SQL functions make atomic start possible.

## How it works

Read the `.d.ts` files and the system-database migration source of the installed package.

## Key findings and evidence

- runStep and reserveStep. [S] `dbos/dist/src/dbos.d.ts:692-701`
- Step retry config. [S] `dbos/dist/src/step.d.ts:5-26`
- send/recv/setEvent/getEvent. [S] `dbos/dist/src/dbos.d.ts:570-607`
- StartWorkflowParams with workflowAttributes. [S] `dbos/dist/src/dbos.d.ts:28-43`
- maxRecoveryAttempts default 100. [S] `dbos/dist/src/workflow.d.ts:30-57`
- Queue concurrency and partitions. [S] `dbos/dist/src/wfqueue.d.ts:29-56`
- patch / deprecatePatch. [S] `dbos/dist/src/dbos.d.ts:718-728`
- applySchedules. [S] `dbos/dist/src/dbos.d.ts:792`
- shutdown with completion timeout. [S] `dbos/dist/src/dbos.d.ts:248`
- SQL enqueue_workflow. [S] `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`
- SQL send_message. [S] `dbos/dist/src/sysdb_migrations/internal/migrations.js:361-380`
- enqueueInTransaction. [S] `dbos/dist/src/client.d.ts:122-136`

## Limits and unknowns

Read declarations and migration source; did not run a workflow here. The prototype did.

## Research recommendation

**Recommendation:** adopt — steps, recv/send, queues with partitions, schedules, patch; prefer SQL-level enqueue in Navier's transaction, fall back to `enqueueInTransaction`.
**Why / consequences:** Both enqueue paths commit with the caller; the SQL function avoids a second client library in the API.
**Do not copy:** Package source is MIT; cite declarations, do not vendor. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `dbos/dist/src/dbos.d.ts` | API |
| `dbos/dist/src/wfqueue.d.ts` | queues |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `dbos/dist/src/client.d.ts` | client |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `dbos/dist/src/debouncer.d.ts` | debouncer, unused |
