# P2.2 Steps, retries, timeouts and the attempt source: each `TurnSteps` call as `DBOS.runStep` with today's limits; attempts from rows, not from DBOS

Status: BINDING through pass 3
Depends on: product contract [`README.md`](../../README.md); [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md), [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md).
Program: [`PHASE2_P2.2_STEPS_RETRIES_PROGRAM.md`](PHASE2_P2.2_STEPS_RETRIES_PROGRAM.md). Review: [`reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md`](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md).
Sources: research [navier-step-bodies](indexing/navier-step-bodies.md), [dbos-workflow-semantics](indexing/dbos-workflow-semantics.md).

## Design explained

| Step | DBOS config | From today |
|------|-------------|------------|
| `loadTurn`, `checkStop`, `failAction`, `pauseTurn`, `finishTurn` | `retriesAllowed`, `maxAttempts` 5, `intervalSeconds` 1, `backoffRate` 2, `timeoutMS` = `STORE_CALL_TIMEOUT_MS` | store activities (`navier/runtime/config.ts:4-13`) |
| `modelStep` | `maxAttempts` = `MODEL_ATTEMPTS`, `timeoutMS` = `MODEL_CALL_TIMEOUT_MS`, `shouldRetry` = retryable code | `navier/runtime/turn-loop.ts:145-149` |
| `toolCall` | `maxAttempts` = `action.attempts`, `timeoutMS` = `TOOL_CALL_TIMEOUT_MS` | `navier/runtime/turn-loop.ts:104-108` |

(D1) Step configs mirror today's activity options; DBOS step config fields are `dbos/dist/src/step.d.ts:5-26`.

(D2) `shouldRetry` reuses the existing classification: `unavailable` and `aborted` retry, `parseArgs` failures and every other code do not (`navier/runtime/activities.ts:76-103`). A non-retryable model error ends the turn `model_refused` / `model_failed` exactly as `modelFailureEnd` (`navier/runtime/turn-loop.ts:67-76`).

(D3) The abort signal passed into `ModelAdapter.generate` and tool implementations is `AbortSignal.any([stepStatus.timeoutSignal, stepStatus.cancelSignal, stopHub.signal(workflowId)])` (`dbos/dist/src/context.d.ts:4-19`). A stop abort throws `StopAbort`, which `shouldRetry` refuses.

(D4) **Attempt source.** `toolCall` decides "interrupted earlier attempt" by comparing a stored `running` row's attempt with the current attempt (`navier/runtime/tool-call.ts:440-467`). DBOS's `currentAttempt` counts within one execution and restarts after recovery [U, [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md) B2], so `running(attempt=1) >= 1` would wrongly return DONE after a crash. The DBOS runner passes `attempt = 1 + max(stored attempt for this action)`, read inside the step. `modelStep` gets the same rule; its attempt only feeds `step_claim`, which DBOS does not use.

(D5) `ModelAdapter.generate(request, credentials, signal, onChunk)` (`navier/llm/types.ts:81-88`) is called unchanged; the publisher still appends deltas per chunk (`navier/runtime/model-step.ts:480-505`). No AI SDK enters the runner.

(D6) **Parallel tools.** Today's pool starts actions in call order with a concurrency bound (`navier/runtime/turn-loop.ts:94-133`); `Promise.race` makes start order timing-dependent, which DBOS replay forbids. The DBOS pool calls `DBOS.reserveStep()` for every action in call order before running any (`dbos/dist/src/dbos.d.ts:692-701`), then runs reservations with a local semaphore of `toolCallConcurrency`. When a result is `blocked`, unstarted reservations are skipped and recorded as a no-op step so the step count stays deterministic.

(D7) A tool step that exhausts its attempts runs `failAction(interrupted)` as today (`navier/runtime/turn-loop.ts:110-118`).

## Context and scope

Activity options and the retryable table are the source of truth.

## Goals and non-goals

**Goals**

- **G1 —** Same retry and timeout behaviour as today.
- **G2 —** No false DONE after recovery.

**Non-goals**

- Changing `llm/`.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Step configs | limits | runStep options | config.ts |
| Classification | retry or not | `shouldRetry` | activities.ts |
| Abort | signal union | AbortSignal | [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md) hub |
| Attempt | DB-derived | number | tool-call D3 |
| Pool | deterministic order | reserveStep | DBOS |

## Decisions and rationale

### D1 — Step configs mirror activity options

Table above. [pass 2]

### D2 — `shouldRetry` from the retryable table

unavailable/aborted only. [pass 1]

### D3 — Abort union

timeout ∪ cancel ∪ stop hub. [pass 1]

### D4 — DB-derived attempt

`1 + max(stored attempt)`; never `stepStatus.currentAttempt`. [pass 2]

### D5 — ModelAdapter unchanged

No AI SDK. [pass 1]

### D6 — Deterministic parallel pool

`reserveStep` in call order, local semaphore, skipped reservations recorded. [pass 3]

### D7 — failAction interrupted

Unchanged. [pass 1]

## Relevant cross-cutting concerns

Step outputs are ids/enums ([P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) L2): `modelStep` returns `{done, waiting, runnable: actionId[]}` only.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D5, D6, D7 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-1) — VERDICT fix-then-ready. | D5: AI SDK streamText in the step — owner decision 2; D6: `Promise.allSettled` in arrival order — non-deterministic starts | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-2) — VERDICT fix-then-ready. | D4: use `currentAttempt` — false DONE after recovery | [review round 1](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-1); new D4 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | D6 | Review fixes for R2-F1 ([round 2](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md#round-2); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
