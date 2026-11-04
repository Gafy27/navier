# P4.3 program review — Identity propagation and checks inside DBOS steps

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md`](../PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE4_P4.3_WORKFLOW_AUTHZ.md`](../PHASE4_P4.3_WORKFLOW_AUTHZ.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P2.2](../../phase-2/PHASE2_P2.2_STEPS_RETRIES.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    owners — Error table location — evidence: PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md — fix: One module
```

### R1-F1. Error table location

[MEDIUM] Error table location
File: `PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md` (owners)
Issue: Mapping scattered in pass 1.
Fix: One module.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | `engine/errors.ts` (pass 2). |

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
