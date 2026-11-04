# Phase 4 research index — authz-engine

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| aze | `/workspace/authz-engine` | `design 2026-11-03` | owner design |

**Objective:** Know every authorization question Navier asks today and how authz-engine answers each.

## Exit criteria

An agent can map every Authz/AuthzAdmin method and every call site to a seam method and an authz-engine verb from the notes.

## Locked defaults

- 2026-11-04: old client stays only until the authz cutover (owner).
- 2026-11-04: `service-token.ts` is also used by the CLI and is not part of the removal.

## Open research

- authz-engine SDK release date [U].
- Completeness of `ListGrants` for export (markings, spaces) [U].

## Entrypoints and reading order

1. `navier-authz-surface.md`
2. `authz-engine-contract.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`navier-authz-surface.md`](navier-authz-surface.md) | What does Navier ask of authz-api, from where, and what depends on the gRPC client? | intent-level seam; remove client + scope/decision/agent-principal | ready (2026-11-04) | [P4.1](../PHASE4_P4.1_AUTHZ_SEAM.md), [P4.2](../PHASE4_P4.2_NAVIER_MODEL.md), [P4.5](../PHASE4_P4.5_GRPC_REMOVAL.md) |
| [`authz-engine-contract.md`](authz-engine-contract.md) | What does authz-engine promise: verbs, identity, errors, transactions, agents, approvals, writes and audit? | adopt the five verbs and tx-bound principal | ready (2026-11-04) | [P4.1](../PHASE4_P4.1_AUTHZ_SEAM.md), [P4.2](../PHASE4_P4.2_NAVIER_MODEL.md), [P4.3](../PHASE4_P4.3_WORKFLOW_AUTHZ.md), [P4.4](../PHASE4_P4.4_AUTHZ_CUTOVER.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
