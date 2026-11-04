# P2.4 architecture review — Approval and pause as a durable wait

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.4_APPROVAL_PAUSE.md`](../PHASE2_P2.4_APPROVAL_PAUSE.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.3](../PHASE2_P2.3_STOP_INTERRUPT.md), [P4.3](../../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D4 — Expiry races a decision — evidence: PHASE2_P2.4_APPROVAL_PAUSE.md — fix: CAS on `paused`, re-wait on loss; state the clock rule
```

### R1-F1. Expiry races a decision

[HIGH] Expiry races a decision
File: `PHASE2_P2.4_APPROVAL_PAUSE.md` (D4)
Issue: Worker clock fires the deadline while the DB clock accepted a decision; pass 1 closed `expired` and lost it.
Fix: CAS on `paused`, re-wait on loss; state the clock rule.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D4 amended, L1 added (pass 2). |

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
