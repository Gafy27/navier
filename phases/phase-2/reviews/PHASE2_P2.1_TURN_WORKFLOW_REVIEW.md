# P2.1 architecture review — The DBOS turn workflow

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.1_TURN_WORKFLOW.md`](../PHASE2_P2.1_TURN_WORKFLOW.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.2](../PHASE2_P2.2_STEPS_RETRIES.md), [P2.3](../PHASE2_P2.3_STOP_INTERRUPT.md), [P2.4](../PHASE2_P2.4_APPROVAL_PAUSE.md), [P2.5](../PHASE2_P2.5_EXACTLY_ONCE.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D3 — Load-time waiting not handled — evidence: PHASE2_P2.1_TURN_WORKFLOW.md — fix: Branch to the wait first
MAJOR    D3 — awaitEnd needs a wake — evidence: PHASE2_P2.1_TURN_WORKFLOW.md — fix: Publish a status event
```

### R1-F1. Load-time waiting not handled

[HIGH] Load-time waiting not handled
File: `PHASE2_P2.1_TURN_WORKFLOW.md` (D3)
Issue: Pass 1 entered the step loop even when `loadTurn` reported `waiting` (a turn recovered while paused), which would call the model with a blocked action.
Fix: Branch to the wait first.

### R1-F2. awaitEnd needs a wake

[MEDIUM] awaitEnd needs a wake
File: `PHASE2_P2.1_TURN_WORKFLOW.md` (D3)
Issue: SDK `awaitTurn` would poll rows.
Fix: Publish a status event.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D3 waits when `blocked or loaded.waiting` (pass 2). |
| R1-F2 | fixed | D7 added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **ready**.

```
VERDICT: ready
MINOR    D2 — Partition key could be thread only — evidence: PHASE2_P2.1_TURN_WORKFLOW.md — fix: Keep org prefix
```

### R2-F1. Partition key could be thread only

[LOW] Partition key could be thread only
File: `PHASE2_P2.1_TURN_WORKFLOW.md` (D2)
Issue: Thread ids are unique.
Fix: Keep org prefix.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | rejected | Org prefix keeps listing by org cheap and avoids cross-org collisions in fixtures. |
