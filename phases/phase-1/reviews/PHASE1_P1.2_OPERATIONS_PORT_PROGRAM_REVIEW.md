# P1.2 program review — Port every runner call site to the interface

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md`](../PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE1_P1.2_OPERATIONS_PORT.md`](../PHASE1_P1.2_OPERATIONS_PORT.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P1.3](../PHASE1_P1.3_TEMPORAL_FREEZE.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    callsites — Chat handler missed — evidence: PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md — fix: Add it
```

### R1-F1. Chat handler missed

[MEDIUM] Chat handler missed
File: `PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md` (callsites)
Issue: The chat route constructs start deps with the Temporal handle (`navier/api/routes/chat/handler.ts:95-120`).
Fix: Add it.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | Added to the table and PD2 (pass 2). |

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
