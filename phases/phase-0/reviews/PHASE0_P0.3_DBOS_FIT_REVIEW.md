# P0.3 architecture review — DBOS fit: each need mapped to a DBOS 5.4.0 API

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE0_P0.3_DBOS_FIT.md`](../PHASE0_P0.3_DBOS_FIT.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P2.1](../../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md), [P2.5](../../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P6.1](../../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md).

Verdict: **ready** (round 3). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D4 — recv waits forever is wrong — evidence: PHASE0_P0.3_DBOS_FIT.md — fix: Correct and require explicit deadlines
```

### R1-F1. recv waits forever is wrong

[HIGH] recv waits forever is wrong
File: `PHASE0_P0.3_DBOS_FIT.md` (D4)
Issue: Pass 1 said `recv` without options waits indefinitely; the SDK default is 60 s, so a pause would time out after a minute.
Fix: Correct and require explicit deadlines.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D4 corrected with the declaration cite (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D1 — SQL enqueue assumed compatible — evidence: PHASE0_P0.3_DBOS_FIT.md — fix: Mark [U], add a blocker and a fallback
```

### R2-F1. SQL enqueue assumed compatible

[MEDIUM] SQL enqueue assumed compatible
File: `PHASE0_P0.3_DBOS_FIT.md` (D1)
Issue: The M1 row presents `dbos.enqueue_workflow` as drop-in, but its args are portable JSON.
Fix: Mark [U], add a blocker and a fallback.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D6 and B1 added (pass 3). |

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
