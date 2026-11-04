# P4.2 architecture review — Navier as an authz-engine model

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.2_NAVIER_MODEL.md`](../PHASE4_P4.2_NAVIER_MODEL.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P4.3](../PHASE4_P4.3_WORKFLOW_AUTHZ.md), [P4.4](../PHASE4_P4.4_AUTHZ_CUTOVER.md).

Verdict: **ready** (round 3). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — AgentUse answers lost — evidence: PHASE4_P4.2_NAVIER_MODEL.md — fix: Map the three answers
```

### R1-F1. AgentUse answers lost

[HIGH] AgentUse answers lost
File: `PHASE4_P4.2_NAVIER_MODEL.md` (D1)
Issue: Pass 1 modelled `use` as a boolean; `open` with a version and `not_visible` are product answers.
Fix: Map the three answers.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D6 added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
MAJOR    D1 — Markings syntax assumed — evidence: PHASE4_P4.2_NAVIER_MODEL.md — fix: Record as blocker
```

### R2-F1. Markings syntax assumed

[MEDIUM] Markings syntax assumed
File: `PHASE4_P4.2_NAVIER_MODEL.md` (D1)
Issue: The `@deny` line is illustrative; authz-engine's exact form is not BINDING here.
Fix: Record as blocker.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | B1 added (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **ready**.

```
VERDICT: ready
MINOR    D3 — Two checks per tool call — evidence: PHASE4_P4.2_NAVIER_MODEL.md — fix: Accept
```

### R3-F1. Two checks per tool call

[LOW] Two checks per tool call
File: `PHASE4_P4.2_NAVIER_MODEL.md` (D3)
Issue: Cost.
Fix: Accept.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | rejected | Both run in one `tx`, one round trip each ([P4.3](../PHASE4_P4.3_WORKFLOW_AUTHZ.md)). |
