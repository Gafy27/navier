# Phase 5 research index — Migration and cutover

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |

**Objective:** Know how long Temporal turns can live and what keeps them alive, to size the drain.

## Exit criteria

An agent can state the maximum lifetime of a Temporal turn (running and paused) from the notes.

## Locked defaults

- 2026-11-04: ownership by `dbos.workflow_status` lookup ([P1.1](../../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4).

## Open research

- Longest configured `pauseTimeout` in production [U].

## Entrypoints and reading order

1. `drain-inputs.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`drain-inputs.md`](drain-inputs.md) | How long can an in-flight Temporal turn live after new turns move to DBOS? | bounded by pauseTimeout + recoveries | ready (2026-11-04) | [P5.1](../PHASE5_P5.1_DRAIN_DUALRUN.md), [P5.4](../PHASE5_P5.4_RUNBOOK.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
