# P5.1 architecture review — Drain and dual-run

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE5_P5.1_DRAIN_DUALRUN.md`](../PHASE5_P5.1_DRAIN_DUALRUN.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P5.3](../PHASE5_P5.3_ROLLBACK_COMPAT.md), [P1.3](../../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Temporal reaper would restart DBOS turns — evidence: PHASE5_P5.1_DRAIN_DUALRUN.md — fix: Make the reaper skip DBOS-owned rows
```

### R1-F1. Temporal reaper would restart DBOS turns

[CRITICAL] Temporal reaper would restart DBOS turns
File: `PHASE5_P5.1_DRAIN_DUALRUN.md` (D1)
Issue: The frozen reaper lists every stale `created` message and restarts it on Temporal when no Temporal execution exists — which is true for every DBOS turn.
Fix: Make the reaper skip DBOS-owned rows.

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
