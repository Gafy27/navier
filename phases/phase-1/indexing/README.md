# Phase 1 research index — Runner seam

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |

**Objective:** Know every place domain code touches Temporal so the seam is complete.

## Exit criteria

An agent can list every runner call site (start, signal, await, schedule, probe) with its line from the notes.

## Locked defaults

- 2026-11-04: interface is in `src/runner/types.ts`; domain stays in `src/runtime/`.

## Open research

- Whether Navier's test setup already has `@temporalio/testing` [U]; package.json is not in the zip.

## Entrypoints and reading order

1. `runner-call-sites.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`runner-call-sites.md`](runner-call-sites.md) | Where does domain or API code start, signal, await, schedule or probe a workflow? | six operations cover all sites | ready (2026-11-04) | [P1.1](../PHASE1_P1.1_RUNNER_INTERFACE.md), [P1.2](../PHASE1_P1.2_OPERATIONS_PORT.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
