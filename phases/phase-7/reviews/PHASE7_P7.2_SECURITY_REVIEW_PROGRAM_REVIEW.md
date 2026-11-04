# P7.2 program review — Security review

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md`](../PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md) (kind `program`), passes 1–3; read against BINDING architecture [`PHASE7_P7.2_SECURITY_REVIEW.md`](../PHASE7_P7.2_SECURITY_REVIEW.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P3.4](../../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) program.

Verdict: **ready** (round 3). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  PD1 — Grants list incomplete — evidence: PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md — fix: Derive the list from a staging run
```

### R1-F1. Grants list incomplete

[HIGH] Grants list incomplete
File: `PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md` (PD1)
Issue: The executor writes to several system tables; a too-small grant breaks recovery at runtime.
Fix: Derive the list from a staging run.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD1: generated from a recorded staging run, checked in CI with a restricted role (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
MAJOR    PD2 — Assert cost on hot path — evidence: PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md — fix: Assert only inputs, messages and events; step outputs by type
```

### R2-F1. Assert cost on hot path

[MEDIUM] Assert cost on hot path
File: `PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md` (PD2)
Issue: Walking every step output adds latency.
Fix: Assert only inputs, messages and events; step outputs by type.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | PD2 narrowed (pass 3). |

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
