# Phase 6 research index — Operations

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| dbos | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | `5.4.0` | MIT |

**Objective:** Know the DBOS operational knobs and the Navier process lifecycle they plug into.

## Exit criteria

An agent can configure executor identity, shutdown, queues and OTLP from the notes without opening the SDK.

## Locked defaults

- 2026-11-04: worker outside Vercel (owner decision 4).

## Open research

- Semantics of `resumeWorkflow` on a PENDING workflow owned by a dead executor [U].

## Entrypoints and reading order

1. `dbos-ops-surface.md`
2. `navier-process-lifecycle.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`dbos-ops-surface.md`](dbos-ops-surface.md) | Which DBOS knobs govern identity, recovery, shutdown, queues and telemetry? | executorID + applicationVersion pinned; shutdown with completion timeout; partitioned queue; enableOTLP | ready (2026-11-04) | [P6.1](../PHASE6_P6.1_WORKER_DEPLOYMENT.md), [P6.2](../PHASE6_P6.2_SCALING_QUEUES.md), [P6.3](../PHASE6_P6.3_OBSERVABILITY.md) |
| [`navier-process-lifecycle.md`](navier-process-lifecycle.md) | What do worker processes do on start, readiness and signal today? | reuse runProcess; add DBOS as a tracked resource | ready (2026-11-04) | [P6.1](../PHASE6_P6.1_WORKER_DEPLOYMENT.md), [P6.3](../PHASE6_P6.3_OBSERVABILITY.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
