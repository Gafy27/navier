# P6.2 architecture review — Queues, partitions and sizing

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE6_P6.2_SCALING_QUEUES.md`](../PHASE6_P6.2_SCALING_QUEUES.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P6.5](../PHASE6_P6.5_LOAD_CHAOS.md), [P2.1](../../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D1 — Lock still needed? — evidence: PHASE6_P6.2_SCALING_QUEUES.md — fix: Keep as guard during drain (Temporal turns are not on the queue)
```

### R1-F1. Lock still needed?

[MEDIUM] Lock still needed?
File: `PHASE6_P6.2_SCALING_QUEUES.md` (D1)
Issue: With partitionConcurrency 1 the thread lock looks redundant.
Fix: Keep as guard during drain (Temporal turns are not on the queue).

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D1 states the lock guards against Temporal turns in the drain (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **ready**.

```
VERDICT: ready
(no findings)
```

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| — | — | No findings. |
