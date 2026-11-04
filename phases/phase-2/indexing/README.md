# Phase 2 research index — DBOS turn workflow

Router for this phase's research notes (`policy/indexing.md`). Trees were read for this project on 2026-11-04. `navier` is the code under redesign (source of truth, read-only); `dbos` is the installed SDK; `proto` and `aze` are owner work. Notes cite `tree/path:a-b`; the validator checks every path and line range.

| Tree | Root | Pin | License |
|------|------|-----|---------|
| navier | `/workspace/attach/navier/src` | `zip 2026-11-04` | owner code, read-only |
| dbos | `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` | `5.4.0` | MIT |
| proto | `/workspace/dbos-agent` | `no-vcs` | owner prototype |

**Objective:** Know DBOS workflow, step, message and queue semantics precisely enough to write the turn workflow, and the Navier step details it must preserve.

## Exit criteria

An agent can state from the notes what happens to a step, a recv and a queue slot on crash, retry, cancel and deploy.

## Locked defaults

- 2026-11-04: workflow id = `turnWorkflowId` (unchanged).
- 2026-11-04: `recv` waits always pass a deadline (default 60 s).

## Open research

- portable_json decode of SQL-enqueued args [U] ([P0.3](../../phase-0/PHASE0_P0.3_DBOS_FIT.md) B1).
- step attempt after recovery [U] ([P0.3](../../phase-0/PHASE0_P0.3_DBOS_FIT.md) B2).

## Entrypoints and reading order

1. `dbos-workflow-semantics.md`
2. `navier-step-bodies.md`
3. `stop-and-pause-paths.md`

## Research order

Local pin first: `rg` under the paths named in each note, then open only P0 slices. Live web is disabled (`tools.firecrawl: false`); DBOS facts come from the installed SDK, docs.dbos.dev read 2026-11-04 (`[Doc]`), or are marked `[U]`. Checkout wins on conflict.

## Notes

| Note | Question | Recommendation | Status | Used by |
|------|----------|----------------|--------|---------|
| [`dbos-workflow-semantics.md`](dbos-workflow-semantics.md) | What does DBOS guarantee for steps, recv/send, events, queues, timeouts, cancellation and versions? | adopt with explicit deadlines and catch-all | ready (2026-11-04) | [P2.1](../PHASE2_P2.1_TURN_WORKFLOW.md), [P2.2](../PHASE2_P2.2_STEPS_RETRIES.md), [P2.3](../PHASE2_P2.3_STOP_INTERRUPT.md), [P2.4](../PHASE2_P2.4_APPROVAL_PAUSE.md), [P2.5](../PHASE2_P2.5_EXACTLY_ONCE.md) |
| [`navier-step-bodies.md`](navier-step-bodies.md) | What do loadTurn, modelStep and toolCall assume about attempts, run keys, retries and abort? | keep bodies; change attempt source | ready (2026-11-04) | [P2.2](../PHASE2_P2.2_STEPS_RETRIES.md), [P2.5](../PHASE2_P2.5_EXACTLY_ONCE.md) |
| [`stop-and-pause-paths.md`](stop-and-pause-paths.md) | How do stops, pauses, decisions and expiries interact today, and what does the prototype do instead? | rows stay; wake via send | ready (2026-11-04) | [P2.3](../PHASE2_P2.3_STOP_INTERRUPT.md), [P2.4](../PHASE2_P2.4_APPROVAL_PAUSE.md) |

## INDEXING_SESSIONS.md

Queued next notes: [`INDEXING_SESSIONS.md`](INDEXING_SESSIONS.md). Do not write a binding design from this router.
