# P2.5 program review — Atomic start, exactly-once writes, versioning and the replay-test replacement

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md`](../PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE2_P2.5_EXACTLY_ONCE.md`](../PHASE2_P2.5_EXACTLY_ONCE.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P3.1](../../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    PD1 — Spike result recording — evidence: PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md — fix: Into the dbos-fit doc
```

### R1-F1. Spike result recording

[MEDIUM] Spike result recording
File: `PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md` (PD1)
Issue: Where does the spike outcome go?
Fix: Into the dbos-fit doc.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD1 writes the outcome to `docs/runner/dbos-fit.md` (pass 2). |

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
