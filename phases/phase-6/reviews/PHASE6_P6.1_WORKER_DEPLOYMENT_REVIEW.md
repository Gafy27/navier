# P6.1 architecture review — Worker deployment and lifecycle

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE6_P6.1_WORKER_DEPLOYMENT.md`](../PHASE6_P6.1_WORKER_DEPLOYMENT.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P6.4](../PHASE6_P6.4_FAILURE_MODES.md), [P5.3](../../phase-5/PHASE5_P5.3_ROLLBACK_COMPAT.md).

Verdict: **not-ready** (round 3). Not ready after round 3; BINDING recorded under owner request (pt151u) with unresolved R3-F1, R3-F2.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D2 — Scale-down orphans workflows — evidence: PHASE6_P6.1_WORKER_DEPLOYMENT.md — fix: Drain before removal
```

### R1-F1. Scale-down orphans workflows

[HIGH] Scale-down orphans workflows
File: `PHASE6_P6.1_WORKER_DEPLOYMENT.md` (D2)
Issue: Removing a slot with PENDING workflows leaves them unrecovered forever.
Fix: Drain before removal.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D5 added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D4 — Shutdown timeout exceeds the process budget — evidence: PHASE6_P6.1_WORKER_DEPLOYMENT.md — fix: Subtract a margin
```

### R2-F1. Shutdown timeout exceeds the process budget

[HIGH] Shutdown timeout exceeds the process budget
File: `PHASE6_P6.1_WORKER_DEPLOYMENT.md` (D4)
Issue: `workflowCompletionTimeoutMS` equal to SHUTDOWN_TIMEOUT_MS leaves no time to close the pool.
Fix: Subtract a margin.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D4: budget minus 5 s (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D5 — Orphan-slot recovery semantics unknown — evidence: PHASE6_P6.1_WORKER_DEPLOYMENT.md — fix: Verify against DBOS docs or a spike; or start a replacement slot with the lost executor ID
MAJOR    D5 — Per-executor queue listening — evidence: PHASE6_P6.1_WORKER_DEPLOYMENT.md — fix: Verify
```

### R3-F1. Orphan-slot recovery semantics unknown

[HIGH] Orphan-slot recovery semantics unknown
File: `PHASE6_P6.1_WORKER_DEPLOYMENT.md` (D5)
Issue: `resumeWorkflow` on a PENDING workflow whose executor is dead is not documented in the 5.4.0 types; the executor-level `recoverPendingWorkflows(executorIDs)` is not public (`dbos/dist/src/dbos-executor.d.ts:286-296`).
Fix: Verify against DBOS docs or a spike; or start a replacement slot with the lost executor ID.

### R3-F2. Per-executor queue listening

[MEDIUM] Per-executor queue listening
File: `PHASE6_P6.1_WORKER_DEPLOYMENT.md` (D5)
Issue: Whether one executor can stop dequeuing while others continue (`listenQueues`) is [U] in 5.4.0.
Fix: Verify.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | deferred | Interim: restart a pod with the lost ordinal's executor ID (always works); `resumeWorkflow` path verified in [P6.5](../PHASE6_P6.5_LOAD_CHAOS.md) chaos run C4. Open. |
| R3-F2 | deferred | Verified in [P6.5](../PHASE6_P6.5_LOAD_CHAOS.md); fallback is scale the Deployment so the slot is never assigned new work only by removing it after drain. Open. |
