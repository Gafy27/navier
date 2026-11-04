# DBOS schedules and workflow status fields

**Kind:** module
**Source:** `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` (@dbos-inc/dbos-sdk 5.4.0 as installed, MIT, pin `5.4.0`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P3.1, P3.3
**Verdict axis:** live
**Status:** ready

**Question:** How are scheduled workflows declared, and which status fields can a sweep read?

## Answer in plain language

`applySchedules` declares named cron schedules for registered workflows, idempotently, with optional queue and backfill; the scheduled function receives the fire time. `WorkflowStatus` carries status, timestamps, queue, executor, application version and `recoveryAttempts`; `listWorkflows` filters by status, name, time and ids.

## Why it matters for this project

The sweep can find dead-lettered and errored turns and read recovery counts without Navier tables.

## How it works

Declarations.

## Key findings and evidence

- applySchedules. [S] `dbos/dist/src/dbos.d.ts:792-800`
- ScheduleOptions. [S] `dbos/dist/src/scheduler/scheduler.d.ts:5-10`
- WorkflowStatus incl. recoveryAttempts. [S] `dbos/dist/src/workflow.d.ts:66-100`
- GetWorkflowsInput. [S] `dbos/dist/src/workflow.d.ts:101-130`
- listWorkflows. [S] `dbos/dist/src/dbos.d.ts:340`

## Limits and unknowns

Not executed.

## Research recommendation

**Recommendation:** adopt — one schedule per sweep; read status from the `dbos` schema by `listWorkflows`.
**Why / consequences:** Reading `dbos.workflow_status` by SQL would couple to internals.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `dbos/dist/src/workflow.d.ts` | status |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `dbos/dist/src/scheduler/scheduler.d.ts` | schedules |
