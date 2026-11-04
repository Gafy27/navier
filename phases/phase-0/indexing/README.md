# Phase 0 research index — Research and map

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| dbos | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | `5.4.0` | MIT |
| proto | `/workspace/dbos-agent` | `no-vcs` | owner prototype |

**Objective:** Know, from notes alone, how a Navier turn moves through rows, Temporal and the reaper, and which DBOS 5.4.0 APIs exist to replace each part.

## Exit criteria

An agent can name every Temporal feature Navier uses with its file and line range, and the DBOS API (or gap) for each, without opening the trees.

## Locked defaults

- 2026-11-04: navier tree is read-only; pin = zip received 2026-11-04 (no git).
- 2026-11-04: DBOS SDK pin 5.4.0 as installed in the owner prototype.

## Open research

- Whether `portable_json` arguments written by the `dbos.enqueue_workflow` SQL function decode for a TypeScript-registered workflow [U].
- Replay test fixtures (`test/`) are not in the zip; only `navier/temporal/replay.test.ts` is visible.

## Entrypoints and reading order

1. `turn-lifecycle.md`
2. `temporal-surface.md`
3. `dbos-sdk-surface.md`
4. `dbos-agent-prototype.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`turn-lifecycle.md`](turn-lifecycle.md) | What happens, in order, from a posted user message to the closed agent message, and where is the state? | keep rows as truth; replace the scheduler | ready (2026-11-04) | [P0.1](../PHASE0_P0.1_CURRENT_STATE_MAP.md), [P0.4](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md), [P2.1](../../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| [`temporal-surface.md`](temporal-surface.md) | Which Temporal features does Navier use, and which surrounding pieces exist only to compensate for Temporal? | freeze; delete compensations on the DBOS path | ready (2026-11-04) | [P0.2](../PHASE0_P0.2_TEMPORAL_INVENTORY.md), [P0.4](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md), [P1.3](../../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) |
| [`dbos-sdk-surface.md`](dbos-sdk-surface.md) | Which DBOS 5.4.0 APIs exist for steps, messages, events, queues, schedules, versioning, recovery and shutdown, and with which options? | adopt; verify serialization of SQL enqueue | ready (2026-11-04) | [P0.3](../PHASE0_P0.3_DBOS_FIT.md), [P2.1](../../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md), [P2.2](../../phase-2/PHASE2_P2.2_STEPS_RETRIES.md), [P2.3](../../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md), [P2.4](../../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md), [P6.2](../../phase-6/PHASE6_P6.2_SCALING_QUEUES.md) |
| [`dbos-agent-prototype.md`](dbos-agent-prototype.md) | What did the owner's prototype prove about DBOS agents? | adopt recv-wait approval pattern | ready (2026-11-04) | [P0.3](../PHASE0_P0.3_DBOS_FIT.md), [P2.4](../../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
