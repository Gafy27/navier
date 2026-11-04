# P2.1 program review — The DBOS turn workflow

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md`](../PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE2_P2.1_TURN_WORKFLOW.md`](../PHASE2_P2.1_TURN_WORKFLOW.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.2](../PHASE2_P2.2_STEPS_RETRIES.md) program, [P2.5](../PHASE2_P2.5_EXACTLY_ONCE.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    owners — L3 has no enforcement — evidence: PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md — fix: Add a check
```

### R1-F1. L3 has no enforcement

[MEDIUM] L3 has no enforcement
File: `PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md` (owners)
Issue: Determinism relied on review only.
Fix: Add a check.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD3 added; owners row for L3 (pass 2). |

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
