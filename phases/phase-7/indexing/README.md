# Phase 7 research index — Hardening, open-source readiness and cleanup

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| dbos | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | `5.4.0` | MIT |
| aze | `/workspace/authz-engine` | `design 2026-11-03` | owner design |

**Objective:** Know what dies with Temporal, what the replay tests guarded, and what the published package needs.

## Exit criteria

An agent can list every file deleted at retirement and the licence facts of each dependency tree.

## Locked defaults

- 2026-11-04: authz-engine is the default authz (owner, steering message).

## Open research

- Navier's current license [U].

## Entrypoints and reading order

1. `retirement-surface.md`
2. `oss-inputs.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`retirement-surface.md`](retirement-surface.md) | Which files and tables exist only for the Temporal runner? | temporal/, workflows.ts, activities.ts, reaper restart, replay tests; tables step_claim/recovery go read-only | ready (2026-11-04) | [P7.1](../PHASE7_P7.1_TEST_MATRIX.md), [P7.4](../PHASE7_P7.4_DEAD_CODE.md) |
| [`oss-inputs.md`](oss-inputs.md) | What licences and docs constrain publishing Navier? | Apache-2.0 proposal; DBOS MIT is compatible | ready (2026-11-04) | [P7.3](../PHASE7_P7.3_OSS_READINESS.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
