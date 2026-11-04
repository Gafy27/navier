# P4.3 architecture review — Identity propagation and checks inside DBOS steps

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.3_WORKFLOW_AUTHZ.md`](../PHASE4_P4.3_WORKFLOW_AUTHZ.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.2](../../phase-2/PHASE2_P2.2_STEPS_RETRIES.md), [P7.2](../../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D7 — Service role usage undefined — evidence: PHASE4_P4.3_WORKFLOW_AUTHZ.md — fix: Restrict to the migration job
```

### R1-F1. Service role usage undefined

[MEDIUM] Service role usage undefined
File: `PHASE4_P4.3_WORKFLOW_AUTHZ.md` (D7)
Issue: Import and `checkAs` need the service role; pass 1 did not restrict where.
Fix: Restrict to the migration job.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D8 added (pass 2). |

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
