# DBOS operational surface

**Kind:** sdk
**Source:** `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` (@dbos-inc/dbos-sdk 5.4.0 as installed, MIT, pin `5.4.0`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P6.1–P6.3
**Verdict axis:** live
**Status:** ready

**Question:** Which DBOS knobs govern identity, recovery, shutdown, queues and telemetry?

## Answer in plain language

`DBOSConfig` carries `executorID`, `applicationVersion`, `enableOTLP` and OTLP endpoints. On launch an executor recovers PENDING workflows recorded under its own executor ID; the executor-level `recoverPendingWorkflows(executorIDs)` exists but is not on the public `DBOS` facade. `DBOS.shutdown({workflowCompletionTimeoutMS})` stops background work then waits for running workflows. Queues take `workerConcurrency`, `globalConcurrency`, `partitionConcurrency`, `partitionWorkerConcurrency` and rate limits; setting any partition limit makes the partition key mandatory. `listWorkflows` filters by `executorId`.

## Why it matters for this project

Executor identity decides who recovers a crashed turn; the rest sizes the worker.

## How it works

Read the installed 5.4.0 type declarations.

## Key findings and evidence

- Config: OTLP, version, executorID. [S] `dbos/dist/src/dbos-executor.d.ts:16-70`
- Executor-level recovery by executor IDs. [S] `dbos/dist/src/dbos-executor.d.ts:286-296`
- Shutdown with completion timeout. [S] `dbos/dist/src/dbos.d.ts:236-252`
- Queue parameters incl. partitions. [S] `dbos/dist/src/wfqueue.d.ts:25-48`
- Workflow status carries executorId. [S] `dbos/dist/src/workflow.d.ts:66-100`
- List filter by executorId. [S] `dbos/dist/src/workflow.d.ts:101-130`
- resumeWorkflow. [S] `dbos/dist/src/dbos.d.ts:383-398`

## Limits and unknowns

Behaviour of resume on PENDING not stated in types [U]; Conductor not read.

## Research recommendation

**Recommendation:** adopt — stable executor IDs; treat orphan-slot recovery as an operator action.
**Why / consequences:** Conductor would add an external dependency to correctness.
**Do not copy:** Call executor internals. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `dbos/dist/src/dbos-executor.d.ts` | config |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `dbos/dist/src/wfqueue.d.ts` | queues |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `dbos/dist/src/debouncer.d.ts` | unused |
