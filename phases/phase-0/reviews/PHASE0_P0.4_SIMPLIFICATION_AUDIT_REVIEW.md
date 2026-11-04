# P0.4 architecture review — Simplification audit of the machinery around the turn workflow

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE0_P0.4_SIMPLIFICATION_AUDIT.md`](../PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [Phase 3](../../phase-3/README.md), [P7.4](../../phase-7/PHASE7_P7.4_DEAD_CODE.md).

Verdict: **not-ready** (round 3). Not ready after round 3; BINDING recorded under owner request (pt151u) with unresolved R3-F1, R3-F2.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D3 — Per-version recovery limit silently dropped — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Keep the setting, enforce it outside the registration
MAJOR    D2 — A11 START_GRACE_MS verdict missing — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Add the row
```

### R1-F1. Per-version recovery limit silently dropped

[HIGH] Per-version recovery limit silently dropped
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D3)
Issue: Pass 1 replaced `maxRecoveries` with a global cap and lost the per-version product setting.
Fix: Keep the setting, enforce it outside the registration.

### R1-F2. A11 START_GRACE_MS verdict missing

[MEDIUM] A11 START_GRACE_MS verdict missing
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D2)
Issue: The table had no row for the grace window.
Fix: Add the row.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D3 now enforces per-version values through the audit sweep (pass 2). |
| R1-F2 | fixed | A11 added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
MAJOR    D2 — Deltas from failed attempts not addressed — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: State the behaviour
MINOR    D2 — Counts do not add up — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Recount
```

### R2-F1. Deltas from failed attempts not addressed

[MEDIUM] Deltas from failed attempts not addressed
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D2)
Issue: Removing step_claim changes nothing for deltas, but the table is silent and an implementer may add cleanup.
Fix: State the behaviour.

### R2-F2. Counts do not add up

[LOW] Counts do not add up
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D2)
Issue: Pass 2 counted 21 rows.
Fix: Recount.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D7 added (pass 3). |
| R2-F2 | fixed | Recounted: 22 (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D4 — Audit sweep is still a reaper — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Prove the sweep is needed after Temporal retires, or delete it then
MAJOR    D3 — Recovery count is not a documented field — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Verify or drop per-version enforcement
MINOR    D1 — Verdict names overlap — evidence: PHASE0_P0.4_SIMPLIFICATION_AUDIT.md — fix: Accept
```

### R3-F1. Audit sweep is still a reaper

[HIGH] Audit sweep is still a reaper
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D4)
Issue: A scheduled pass that closes rows is the reaper's core; the audit may be keeping the machinery it set out to delete. Could the turn workflow close its own row on every exit, leaving no sweep?
Fix: Prove the sweep is needed after Temporal retires, or delete it then.

### R3-F2. Recovery count is not a documented field

[MEDIUM] Recovery count is not a documented field
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D3)
Issue: The sweep reads a recovery counter whose exposure in `listWorkflows` output is [U].
Fix: Verify or drop per-version enforcement.

### R3-F3. Verdict names overlap

[LOW] Verdict names overlap
File: `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` (D1)
Issue: "simplify" and "replace" blur for A4.
Fix: Accept.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | deferred | Needed while a workflow can die by `MAX_RECOVERY_ATTEMPTS_EXCEEDED` or cancel without running code; re-judged by [P7.4](../../phase-7/PHASE7_P7.4_DEAD_CODE.md) after retirement. Open. |
| R3-F2 | deferred | Verification owned by [P3.1](../../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) ticket 1; if absent, per-version limits become a gate. Open. |
| R3-F3 | rejected | A4 keeps code (catch-all) — simplify is right. |
