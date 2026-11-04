# P2.1 The DBOS turn workflow: one message = one workflow on queue `turns`, partitioned by thread; catch-all finish; deterministic code

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md), [P0.3](../phase-0/PHASE0_P0.3_DBOS_FIT.md), [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).
Program: [`PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md`](PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md). Review: [`reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md`](reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md).
Sources: research [dbos-workflow-semantics](indexing/dbos-workflow-semantics.md), [navier-step-bodies](indexing/navier-step-bodies.md); prototype `proto/src/agent.ts:1-133`.

## Design explained

The workflow is the Temporal loop (`navier/runtime/turn-loop.ts:136-228`) without signals, scopes or continue-as-new:

```text
turnWorkflow({ org, threadId, agentMessageId, traceId, service })   // ids + limits only (L2)
  end = undefined
  try
    loaded = step loadTurn                                           // finished → return
    blocked = toolPool(loaded.pending)                               // P2.2 D6
    loop:
      if blocked or loaded.waiting → end = waitForDecision()          // P2.4; may continue loop after resume
      s = step checkStop   → stop? end = stopEnd(s); break            // P2.3 D3
      step = step modelStep(stepIndex, runKey = workflowID)           // P2.2 D2
      done → end = succeeded; break
      waiting → blocked = true; continue
      blocked = toolPool(step.runnable); stepIndex++
      stepIndex == maxSteps → end = max_steps; break
  catch e
    end = e is StopAbort ? stopEnd(e) : modelFailureEnd(e) or errored  // D4
  step finishTurn(end)                                                // CAS close, pending promotion (P3.2)
  return end.status
```

**Queue (D2).** Turns are enqueued on `turns` with `queuePartitionKey = org~threadId` and `partitionConcurrency: 1` (`dbos/dist/src/wfqueue.d.ts:29-56`). At most one turn per thread runs; that is already the product rule (a `created` or `paused` agent message makes new posts pending, `navier/runtime/pending.ts:30-50`), so the queue is a second guard, not new behaviour. A paused turn keeps its partition slot, which matches pending semantics. `workerConcurrency` bounds turns per worker ([P6.2](../phase-6/PHASE6_P6.2_SCALING_QUEUES.md)).

**Catch-all (D4).** An uncaught error would end the workflow in `ERROR`, which DBOS does not recover, and leave the row open. So workflow code catches everything and always runs `finishTurn`; only a failure of `finishTurn` itself (after its retries) leaves an open row, which the audit sweep closes ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md)).

**Determinism (D5).** Workflow code calls only steps, `recv`, `send`, `setEvent`, `DBOS.sleep` and `DBOS.patch`. No clock, random, env, logger with side effects that matter, or DB read outside steps. Limits arrive in the input (`service`, `navier/runtime/workflow-types.ts:4-10`) as today.

**Run key (D6).** `runKey` = workflow id. Temporal used the first execution run id (`navier/runtime/turn-loop.ts:150`) because a decide started a new execution; on DBOS one message has one execution ([P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md)).

**Events (D7).** The workflow sets one event `status` with the newest status enum at pause and end, used by `awaitEnd` ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md)) to wake without polling rows.

## Context and scope

Owner decision 1; audit rows A1, A4, A5 ([P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md)).

## Goals and non-goals

**Goals**

- **G1 —** Same rows as Temporal for S1–S12 ([P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md)).
- **G2 —** No code path leaves a message open except a failed finish.

**Non-goals**

- Step internals ([P2.2](PHASE2_P2.2_STEPS_RETRIES.md)).
- Stop and pause mechanics ([P2.3](PHASE2_P2.3_STOP_INTERRUPT.md), [P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Workflow | control flow | final status | `TurnSteps` |
| Queue `turns` | per-thread serialisation | partition slot | DBOS queue |
| Catch-all | error → errored | always finish | D4 |
| Event `status` | end wake | enum | `awaitEnd` |

## Decisions and rationale

### D1 — One message, one workflow

`navier.turn`, id `turnWorkflowId(org, ids)` (`navier/runtime/workflow-id.ts:4-10`); enqueue of an existing id is a no-op. [pass 1]

### D2 — Queue `turns` partitioned by thread

`partitionConcurrency: 1`; no global cap; `workerConcurrency` configurable. [pass 1]

### D3 — Body

As sketched; pending actions first, then the step loop. [pass 2]

### D4 — Catch-all finish

Every exit runs `finishTurn`; mapping matches `navier/runtime/turn-loop.ts:60-76`. [pass 1]

### D5 — Determinism rules

Only DBOS primitives in workflow code. [pass 1]

### D6 — runKey = workflow id

One execution per message. [pass 1]

### D7 — Event `status`

Enum only; set at pause and end. [pass 2]

## Invariants

- **L1 —** One agent message has at most one DBOS workflow, ever. [pass 1]
- **L2 —** Workflow inputs, outputs, step outputs, messages and events contain only ids, enums, counters and timestamps — never text, arguments, outputs, request context or credentials. [pass 1]
- **L3 —** Workflow code is deterministic: only DBOS primitives outside steps. [pass 1]

## Relevant cross-cutting concerns

Tracing: `traceId` from the input becomes a workflow attribute and span attribute ([P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6, L1, L2, L3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: one workflow per thread — mixes turns, breaks per-message ids; D2: global concurrency cap — head-of-line blocking across orgs; D4: let errors end in ERROR — open rows need a reaper | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D3 | Review fixes for R1-F1, R1-F2 ([round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md#round-2) — VERDICT ready. | D7: poll rows in awaitEnd — slower, more load | [review round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md#round-1); new D7 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
