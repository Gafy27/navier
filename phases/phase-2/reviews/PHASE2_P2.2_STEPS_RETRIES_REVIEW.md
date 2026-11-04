# P2.2 architecture review — Steps, retries, timeouts and the attempt source

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.2_STEPS_RETRIES.md`](../PHASE2_P2.2_STEPS_RETRIES.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P2.1](../PHASE2_P2.1_TURN_WORKFLOW.md), [P2.3](../PHASE2_P2.3_STOP_INTERRUPT.md).

Verdict: **ready** (round 3). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Attempt resets after recovery — evidence: PHASE2_P2.2_STEPS_RETRIES.md — fix: Derive the attempt from rows
```

### R1-F1. Attempt resets after recovery

[HIGH] Attempt resets after recovery
File: `PHASE2_P2.2_STEPS_RETRIES.md` (D1)
Issue: Pass 1 passed `stepStatus.currentAttempt` into `toolCall`; after a crash a `running` row with attempt 1 meets a new attempt 1 and the action is reported DONE without closing.
Fix: Derive the attempt from rows.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D4 added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D6 — Skipped reservations change the step count — evidence: PHASE2_P2.2_STEPS_RETRIES.md — fix: Record skipped reservations as no-op steps
```

### R2-F1. Skipped reservations change the step count

[MEDIUM] Skipped reservations change the step count
File: `PHASE2_P2.2_STEPS_RETRIES.md` (D6)
Issue: When a tool blocks, unstarted reservations were dropped, so a replay after recovery could see a different step sequence.
Fix: Record skipped reservations as no-op steps.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D6 amended (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **ready**.

```
VERDICT: ready
(no findings)
```

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| — | — | No findings. |
