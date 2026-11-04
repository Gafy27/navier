# P3.3 architecture review — Schedules: the turn audit sweep and the stream sweep

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE3_P3.3_SCHEDULES_SWEEPS.md`](../PHASE3_P3.3_SCHEDULES_SWEEPS.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P6.3](../../phase-6/PHASE6_P6.3_OBSERVABILITY.md), [P7.4](../../phase-7/PHASE7_P7.4_DEAD_CODE.md).

Verdict: **ready** (round 3). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Missing-workflow case closes valid drain-window rows — evidence: PHASE3_P3.3_SCHEDULES_SWEEPS.md — fix: Restrict to DBOS-owned rows; enqueue during the drain window
```

### R1-F1. Missing-workflow case closes valid drain-window rows

[HIGH] Missing-workflow case closes valid drain-window rows
File: `PHASE3_P3.3_SCHEDULES_SWEEPS.md` (D1)
Issue: Pass 1 closed every row without a workflow, including Temporal-era rows not yet owned.
Fix: Restrict to DBOS-owned rows; enqueue during the drain window.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | Steps 1 and 5 amended (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D1 — Stop precedence missing — evidence: PHASE3_P3.3_SCHEDULES_SWEEPS.md — fix: Stop wins
```

### R2-F1. Stop precedence missing

[MEDIUM] Stop precedence missing
File: `PHASE3_P3.3_SCHEDULES_SWEEPS.md` (D1)
Issue: A dead-lettered turn with a stop row would close `errored`.
Fix: Stop wins.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D1 states it (pass 3). |

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
