# DBOS workflow, step, message, queue semantics

**Kind:** module
**Source:** `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` (@dbos-inc/dbos-sdk 5.4.0 as installed, MIT, pin `5.4.0`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P2.1–P2.5
**Verdict axis:** live
**Status:** ready

**Question:** What does DBOS guarantee for steps, recv/send, events, queues, timeouts, cancellation and versions?

## Answer in plain language

A completed step's output is checkpointed and never re-run; an interrupted step re-runs (at-least-once). Steps may retry with backoff and a per-attempt timeout that fires `timeoutSignal`; `cancelSignal` fires on workflow cancel. Workflow code must be deterministic; steps cannot start workflows. `send` with an idempotency key is exactly-once; `recv` consumes one message per topic and returns null at the deadline (default 60 s). Queues bound worker, global and per-partition concurrency. A cancelled workflow runs no further code; an uncaught error ends it in ERROR without recovery; `maxRecoveryAttempts` dead-letters a workflow that keeps crashing. `patch` gates code changes for in-flight workflows; versions are pinned per deploy.

## Why it matters for this project

Each semantic maps to one design rule: catch-all finish, explicit deadlines, ids-only payloads, patch discipline.

## How it works

Declarations plus docs pages on workflows, steps, queues, communication, recovery and upgrades.

## Key findings and evidence

- StepConfig: retries, backoff, shouldRetry, timeoutMS. [S] `dbos/dist/src/step.d.ts:5-26`
- StepStatus: attempt, timeoutSignal, cancelSignal. [S] `dbos/dist/src/context.d.ts:4-19`
- runStep / reserveStep. [S] `dbos/dist/src/dbos.d.ts:692-701`
- send / recv / RecvOptions. [S] `dbos/dist/src/dbos.d.ts:570-583`
- RecvOptions default 60 s. [S] `dbos/dist/src/dbos.d.ts:115-121`
- setEvent / getEvent. [S] `dbos/dist/src/dbos.d.ts:594-607`
- cancelWorkflow. [S] `dbos/dist/src/dbos.d.ts:376`
- Statuses incl. MAX_RECOVERY_ATTEMPTS_EXCEEDED. [S] `dbos/dist/src/workflow.d.ts:148-164`
- patch / deprecatePatch. [S] `dbos/dist/src/dbos.d.ts:718-728`
- Queue parameters. [S] `dbos/dist/src/wfqueue.d.ts:29-56`
- Enqueue options. [S] `dbos/dist/src/system_database.d.ts:150-162`
- SQL enqueue ON CONFLICT on workflow id. [S] `dbos/dist/src/sysdb_migrations/internal/migrations.js:544-640`

## Limits and unknowns

Docs read 2026-11-04 (`[Doc]`); behaviour not executed here.

## Research recommendation

**Recommendation:** adopt — steps with explicit configs, recv with deadlines, partitioned queue, patch rule; catch everything in workflow code.
**Why / consequences:** An uncaught error would leave the message row open (ERROR is not recovered).
**Do not copy:** Cite declarations only. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `dbos/dist/src/dbos.d.ts` | API |
| `dbos/dist/src/step.d.ts` | steps |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `dbos/dist/src/wfqueue.d.ts` | queues |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `dbos/dist/src/debouncer.d.ts` | unused |
