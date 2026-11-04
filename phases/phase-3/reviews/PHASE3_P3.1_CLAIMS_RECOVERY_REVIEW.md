# P3.1 architecture review — Claims and recovery off the DBOS path

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE3_P3.1_CLAIMS_RECOVERY.md`](../PHASE3_P3.1_CLAIMS_RECOVERY.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P3.3](../PHASE3_P3.3_SCHEDULES_SWEEPS.md), [P6.1](../../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D2 — Limits above the cap undefined — evidence: PHASE3_P3.1_CLAIMS_RECOVERY.md — fix: State and log it
```

### R1-F1. Limits above the cap undefined

[MEDIUM] Limits above the cap undefined
File: `PHASE3_P3.1_CLAIMS_RECOVERY.md` (D2)
Issue: An agent version with `maxRecoveries: 10` silently gets 3.
Fix: State and log it.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D5 added (pass 2). |

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
