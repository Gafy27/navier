# P5.3 architecture review — Rollback and compatibility

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE5_P5.3_ROLLBACK_COMPAT.md`](../PHASE5_P5.3_ROLLBACK_COMPAT.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P5.4](../PHASE5_P5.4_RUNBOOK.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Code rollback strands DBOS turns — evidence: PHASE5_P5.3_ROLLBACK_COMPAT.md — fix: Skew rule
```

### R1-F1. Code rollback strands DBOS turns

[HIGH] Code rollback strands DBOS turns
File: `PHASE5_P5.3_ROLLBACK_COMPAT.md` (D1)
Issue: Deploying an older build removes the DBOS worker.
Fix: Skew rule.

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
