# P0.1 architecture review — Current-state map of one agent turn

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE0_P0.1_CURRENT_STATE_MAP.md`](../PHASE0_P0.1_CURRENT_STATE_MAP.md) (kind `architecture`), passes 1.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 1 of max 3.
**Sibling interfaces read:** [P0.2](../PHASE0_P0.2_TEMPORAL_INVENTORY.md), [P0.4](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).

Verdict: **ready** (round 1). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **ready**.

```
VERDICT: ready
MINOR    D2 — Stage 2 omits the pending arm — evidence: PHASE0_P0.1_CURRENT_STATE_MAP.md — fix: Mention it
```

### R1-F1. Stage 2 omits the pending arm

[LOW] Stage 2 omits the pending arm
File: `PHASE0_P0.1_CURRENT_STATE_MAP.md` (D2)
Issue: startTurn signals graceful_stop when a pending message arrives during a running turn.
Fix: Mention it.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | rejected | Covered in [P0.2](../PHASE0_P0.2_TEMPORAL_INVENTORY.md) and [P3.2](../../phase-3/PHASE3_P3.2_PENDING_PROMOTION.md); the map keeps one row per stage. |
