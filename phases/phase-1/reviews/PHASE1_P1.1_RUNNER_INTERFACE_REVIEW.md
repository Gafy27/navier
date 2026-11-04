# P1.1 architecture review — Runner interface and runner-neutral steps

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE1_P1.1_RUNNER_INTERFACE.md`](../PHASE1_P1.1_RUNNER_INTERFACE.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P1.2](../PHASE1_P1.2_OPERATIONS_PORT.md), [P1.3](../PHASE1_P1.3_TEMPORAL_FREEZE.md), [P2.1](../../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Stop routing undefined during drain — evidence: PHASE1_P1.1_RUNNER_INTERFACE.md — fix: Define ownership
```

### R1-F1. Stop routing undefined during drain

[HIGH] Stop routing undefined during drain
File: `PHASE1_P1.1_RUNNER_INTERFACE.md` (D1)
Issue: A stop for a turn started on Temporal before the flag flipped would go to DBOS and be lost.
Fix: Define ownership.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D4 added (pass 2). |

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
