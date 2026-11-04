# P3.2 program review — Pending messages and promotion without a lost start

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md`](../PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE3_P3.2_PENDING_PROMOTION.md`](../PHASE3_P3.2_PENDING_PROMOTION.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.5](../../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  types — Layering broken — evidence: PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md — fix: Inject a hook
```

### R1-F1. Layering broken

[HIGH] Layering broken
File: `PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md` (types)
Issue: Pass 1 called the DBOS start directly from `close.ts`.
Fix: Inject a hook.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD1 added (pass 2). |

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
