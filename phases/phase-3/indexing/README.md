# Phase 3 research index — Simplification

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| dbos | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | `5.4.0` | MIT |

**Objective:** Know exactly which reaper, claim, recovery, schedule and pending code paths exist and which DBOS fields replace their inputs.

## Exit criteria

An agent can say for each reaper function whether DBOS replaces it, the sweep keeps it, or it is deleted.

## Locked defaults

- 2026-11-04: `WorkflowStatus.recoveryAttempts` exists in 5.4.0 (`dbos/dist/src/workflow.d.ts:66-100`).

## Open research

- Cost of `listWorkflows` filtered by status at 10^5 workflows [U] ([P6.5](../../phase-6/PHASE6_P6.5_LOAD_CHAOS.md)).

## Entrypoints and reading order

1. `reaper-anatomy.md`
2. `dbos-schedules-and-status.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`reaper-anatomy.md`](reaper-anatomy.md) | What does each reaper function do and what replaces it on DBOS? | keep only the close-terminal pass | ready (2026-11-04) | [P3.1](../PHASE3_P3.1_CLAIMS_RECOVERY.md), [P3.3](../PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| [`dbos-schedules-and-status.md`](dbos-schedules-and-status.md) | How are scheduled workflows declared, and which status fields can a sweep read? | adopt applySchedules + listWorkflows | ready (2026-11-04) | [P3.1](../PHASE3_P3.1_CLAIMS_RECOVERY.md), [P3.3](../PHASE3_P3.3_SCHEDULES_SWEEPS.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
