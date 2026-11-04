# P0.1 program review — Current-state map of one agent turn

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md`](../PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md) (kind `program`), passes 1–2; read against BINDING architecture [`PHASE0_P0.1_CURRENT_STATE_MAP.md`](../PHASE0_P0.1_CURRENT_STATE_MAP.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P0.2](../PHASE0_P0.2_TEMPORAL_INVENTORY.md) program.

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    PD1 — Anchors break once P1.2 moves files — evidence: PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md — fix: Key anchors by function name
```

### R1-F1. Anchors break once P1.2 moves files

[MEDIUM] Anchors break once P1.2 moves files
File: `PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md` (PD1)
Issue: Line ranges alone go stale after the move ticket.
Fix: Key anchors by function name.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD2 added (pass 2). |

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
