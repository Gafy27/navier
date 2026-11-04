# P0.1 Current-state map of one agent turn: post → start → workflow → model step / tool call → pause / decide → close → stream

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); none (first unit).
Program: [`PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md`](PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md). Review: [`reviews/PHASE0_P0.1_CURRENT_STATE_MAP_REVIEW.md`](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_REVIEW.md).
Sources: research [turn-lifecycle](indexing/turn-lifecycle.md).

## Design explained

A Navier turn is **ten stages over Postgres rows** (D2). The runner only schedules and retries the stages; it does not hold the turn's state (D1).

| # | Stage | Owner | Writes | Runner coupling |
|---|-------|-------|--------|-----------------|
| 1 | post / accept | `navier/runtime/post.ts:475-502`, `navier/runtime/post.ts:446-473` | user + agent message (`created`) or `pending_message` | starts the workflow after commit |
| 2 | start | `navier/runtime/start.ts:83-112`, `navier/runtime/start.ts:130-179` | nothing (Temporal start) | id `turn~org~thread~msg` (`navier/runtime/workflow-id.ts:4-10`); failure left to the reaper |
| 3 | workflow | `navier/runtime/workflow.ts:25-37`, `navier/runtime/turn-loop.ts:192-228` | — | signals, scopes, continue-as-new |
| 4 | load | `navier/runtime/activities.ts:105-157` | `started` status | activity |
| 5 | model step | `navier/runtime/model-step.ts:512-564` | step + actions (guarded), deltas | activity + `step_claim` |
| 6 | tool call | `navier/runtime/tool-call.ts:370-547` | action status, result | activity; attempt number |
| 7 | pause | `navier/runtime/close.ts:299-346` | `paused`, `expires_at`, snapshot | workflow ends |
| 8 | decide | `navier/runtime/decide.ts:469-535` | decision, `resumed` | restarts the same workflow id |
| 9 | close | `navier/runtime/close.ts:47-125` | terminal status, pending promotion | promoted start |
| 10 | stream | `navier/runtime/stream.ts:62-104`, `navier/api/stream-hub.ts:41-100` | `stream_delta` + NOTIFY | none |

Every stage that writes uses a guarded append (`navier/db/append.ts:42-75`): the write checks the newest status row, so a repeated activity is a no-op. That is why the runner can change without a data migration (owner decision 5).

`llm/` is runner-neutral behind `ModelAdapter` (`navier/llm/types.ts:81-88`). It already uses the Vercel AI SDK internally as a transport (`navier/llm/errors.ts:1-10`, `navier/llm/providers/generate.ts:1-8`). The owner decided the runner adds **no** AI SDK use and `llm/` stays unchanged (D4); the rejected alternative "run turns through the AI SDK agent loop" is recorded with the note that an AI SDK adapter could be added later behind `ModelAdapter`.

Identity and authz touch the turn at post (`navier/runtime/post.ts:86-125`), tool check (`navier/runtime/tool-call.ts:323-364`), decide (`navier/runtime/decide.ts:164-196`) and stop (`navier/runtime/stop.ts:64-140`); the full inventory is [P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) (D5).

## Context and scope

The zip has `src/` only: no package.json, no tests folder, no git history ([turn-lifecycle](indexing/turn-lifecycle.md)).

## Goals and non-goals

**Goals**

- **G1 —** Every later unit can cite a stage by anchor.
- **G2 —** The map separates state (rows) from scheduling (runner).

**Non-goals**

- Judging the machinery (that is [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).
- Prompt assembly, catalog, publishing internals.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Stage table | stage order, owners | anchors with line ranges | navier zip pin |
| State finding | where truth lives | D1 | `navier/db/append.ts:42-75` |
| llm note | AI SDK position | D4 | owner decision 2 |
| Authz touchpoints | call-site pointers | D5 | [P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md) |

## Decisions and rationale

### D1 — Rows are the truth; the runner is a scheduler

Turn state lives in message, status, step, action and delta rows written by guarded appends; Temporal history holds ids and control flow only (`navier/runtime/workflow-types.ts:13-18`). Consequence: swapping the runner needs no state migration. [pass 1]

### D2 — Ten-stage lifecycle with anchors

The table above is the citation base for every phase. [pass 1]

### D3 — Read-only source at a pin

`navier/` is the zip received 2026-11-04; designs cite it and never edit it. [pass 1]

### D4 — No AI SDK in the runner; `llm/` unchanged

The runner calls `ModelAdapter.generate` exactly as today. Rejected alternative: AI SDK agent loop or `streamText` in workflow steps. Note: an AI SDK `ModelAdapter` could be added later behind the same interface. [pass 1]

### D5 — Authz touchpoints routed to phase 4

Every `authz.*` call found while mapping is listed in [P4.1](../phase-4/PHASE4_P4.1_AUTHZ_SEAM.md); the runner phases treat authz as an injected dependency. [pass 1]

## Invariants

- **L1 —** The map describes the zip; it never prescribes code. [pass 1]

## Relevant cross-cutting concerns

Security: the map records that workflow inputs are ids only — the property every DBOS input keeps ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, D4, D5, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE0_P0.1_CURRENT_STATE_MAP_REVIEW.md#round-1) — VERDICT ready. | D1: treat Temporal history as state — contradicted by the code; D4: adopt the AI SDK agent loop (owner: "ok dont use the sdk then"); D5: map authz inside each runner unit — scatters the inventory | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
