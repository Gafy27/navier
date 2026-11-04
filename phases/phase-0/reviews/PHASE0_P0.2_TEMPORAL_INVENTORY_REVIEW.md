# P0.2 architecture review — Temporal inventory and what the machinery around it is for

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE0_P0.2_TEMPORAL_INVENTORY.md`](../PHASE0_P0.2_TEMPORAL_INVENTORY.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P0.3](../PHASE0_P0.3_DBOS_FIT.md), [P0.4](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md), [P1.3](../../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D2 — Start grace window missing — evidence: PHASE0_P0.2_TEMPORAL_INVENTORY.md — fix: Add M7
```

### R1-F1. Start grace window missing

[MEDIUM] Start grace window missing
File: `PHASE0_P0.2_TEMPORAL_INVENTORY.md` (D2)
Issue: The reaper skips turns younger than `START_GRACE_MS`; the inventory omits it, so the audit could delete the reaper and keep a dead config.
Fix: Add M7.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | M7 added (pass 2). |

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
