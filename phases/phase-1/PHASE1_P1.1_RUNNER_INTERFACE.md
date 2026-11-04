# P1.1 Runner interface and runner-neutral steps: `TurnRunner` (six operations) + `TurnSteps` (domain step bodies)

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P0.1](../phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md), [P0.2](../phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md).
Program: [`PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM.md`](PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM.md). Review: [`reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md`](reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md).
Sources: research [runner-call-sites](indexing/runner-call-sites.md).

## Design explained

Domain code asks a runner for six things and nothing else (D1):

| Operation | Today | Caller |
|-----------|-------|--------|
| `start(tx, ref)` | `startCommitted` after commit (`navier/runtime/start.ts:83-112`) | post, edit, retry, promoted start |
| `wakeStop(tx, ref, kind)` | `signal` cancel/interrupt/graceful (`navier/runtime/stop.ts:129-139`, `navier/runtime/stop.ts:38-56`) | stop, pending arm |
| `wakeDecision(tx, ref, key)` | restart the workflow (`navier/runtime/decide.ts:514-533`) | decide |
| `awaitEnd(ref, signal)` | `handle.result()` (`navier/sdk/turn.ts:135-146`) | SDK `awaitTurn` |
| `probe()` | `temporalProbe` (`navier/temporal/probe.ts:8-37`) | readiness |
| `close()` | client close | process shutdown |

`ref` is `{ org, threadId, agentMessageId, traceId }` — ids only, the same input Temporal gets (`navier/runtime/workflow-types.ts:13-18`). Every operation takes the caller's transaction where it writes, so a runner that can enqueue inside the transaction (DBOS) does, and one that cannot (Temporal) registers an after-commit action that behaves exactly like today (D3).

The step bodies — `loadTurn`, `modelStep`, `toolCall`, `failAction`, `pauseTurn`, `finishTurn` — already live as plain functions wrapped by `runtimeActivities` (`navier/runtime/activities.ts:186-257`). They become `TurnSteps`, exported from `src/runtime/steps.ts` and called by both runners (D2). `checkStop` is added by [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md).

**Ownership (D4).** During the drain both runners run. A stop or decision must reach the runner that owns the turn. A turn belongs to DBOS iff `dbos.workflow_status` has a row with its workflow id (same database, [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) D2); otherwise it is Temporal's. No new column is needed (owner decision 5).

## Context and scope

Thirteen call sites across runtime, sdk, api and the worker ([runner-call-sites](indexing/runner-call-sites.md)).

## Goals and non-goals

**Goals**

- **G1 —** Six operations cover every call site.
- **G2 —** Removing Temporal later deletes one folder and one config branch.

**Non-goals**

- Workflow design ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md)).
- Generic multi-runner plugin system: there are exactly two runners.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| `TurnRunner` | how a turn is scheduled | six operations | `navier/runtime/start.ts:83-112` |
| `TurnSteps` | step bodies | plain async functions returning `Result` | `navier/runtime/activities.ts:186-257` |
| Ownership | which runner owns a ref | `ownerOf(tx, ref)` | [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 |
| Layering | import direction | L1 | profile layering |

## Decisions and rationale

### D1 — Six operations

`start`, `wakeStop`, `wakeDecision`, `awaitEnd`, `probe`, `close`. [pass 2]

### D2 — Steps are runner-neutral functions

`TurnSteps` in `src/runtime/steps.ts`; runners wrap them as activities or DBOS steps. [pass 1]

### D3 — Writes take the caller's transaction

DBOS enqueues/sends in it; Temporal defers to after-commit, unchanged behaviour. [pass 1]

### D4 — Ownership by workflow-id lookup

DBOS owns a ref iff `dbos.workflow_status` has its id; else Temporal. [pass 2]

## Invariants

- **L1 —** `src/runtime/` imports no runner SDK. [pass 1]
- **L2 —** Every `TurnRunner` operation is idempotent per workflow id. [pass 1]

## Relevant cross-cutting concerns

Ids-only `ref` keeps the [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) security law.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, L1, L2 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: expose the Temporal client shape — leaks; D3: start after commit on both — keeps lost starts on DBOS | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md#round-2) — VERDICT ready. | D4: new `runner` column — owner keeps tables | [review round 1](reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md#round-1); new D4 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
