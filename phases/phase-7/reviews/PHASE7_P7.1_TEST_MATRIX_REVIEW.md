# P7.1 architecture review — DBOS test matrix

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE7_P7.1_TEST_MATRIX.md`](../PHASE7_P7.1_TEST_MATRIX.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P6.5](../../phase-6/PHASE6_P6.5_LOAD_CHAOS.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Nothing replaces replay — evidence: PHASE7_P7.1_TEST_MATRIX.md — fix: Add version-patch test and purity lint
```

### R1-F1. Nothing replaces replay

[HIGH] Nothing replaces replay
File: `PHASE7_P7.1_TEST_MATRIX.md` (D1)
Issue: Removing replay tests without a version-skew test loses the only guard against breaking in-flight workflows.
Fix: Add version-patch test and purity lint.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D2 added (pass 2). |

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
