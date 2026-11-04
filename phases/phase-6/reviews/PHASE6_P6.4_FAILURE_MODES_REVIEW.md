# P6.4 architecture review — Failure-mode table

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE6_P6.4_FAILURE_MODES.md`](../PHASE6_P6.4_FAILURE_MODES.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P6.5](../PHASE6_P6.5_LOAD_CHAOS.md), [P5.4](../../phase-5/PHASE5_P5.4_RUNBOOK.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — Authz outage missing — evidence: PHASE6_P6.4_FAILURE_MODES.md — fix: Add F10
```

### R1-F1. Authz outage missing

[HIGH] Authz outage missing
File: `PHASE6_P6.4_FAILURE_MODES.md` (D1)
Issue: authz-engine shares the DB; its failure path was not listed.
Fix: Add F10.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | F10 added (pass 2). |

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
