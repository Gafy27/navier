# P4.1 architecture review — Authz seam and call-site inventory

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.1_AUTHZ_SEAM.md`](../PHASE4_P4.1_AUTHZ_SEAM.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P4.2](../PHASE4_P4.2_NAVIER_MODEL.md), [P4.5](../PHASE4_P4.5_GRPC_REMOVAL.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D3 — Inventory missed AuthzAdmin consumers — evidence: PHASE4_P4.1_AUTHZ_SEAM.md — fix: Add them
MAJOR    D2 — agent-principal dependency misstated — evidence: PHASE4_P4.1_AUTHZ_SEAM.md — fix: State the real reason to retire it
MAJOR    D1 — Fail-closed not a law — evidence: PHASE4_P4.1_AUTHZ_SEAM.md — fix: Law
```

### R1-F1. Inventory missed AuthzAdmin consumers

[HIGH] Inventory missed AuthzAdmin consumers
File: `PHASE4_P4.1_AUTHZ_SEAM.md` (D3)
Issue: Pass 1 listed only `Authz` sites; `catalog/list.ts`, `api/routes/authz/directory.ts`, `api/conversation-access.ts` and `api/adapter/app.ts` use `AuthzAdmin`.
Fix: Add them.

### R1-F2. agent-principal dependency misstated

[MEDIUM] agent-principal dependency misstated
File: `PHASE4_P4.1_AUTHZ_SEAM.md` (D2)
Issue: Pass 1 said agent-principal depends on the gRPC client; it does not.
Fix: State the real reason to retire it.

### R1-F3. Fail-closed not a law

[MEDIUM] Fail-closed not a law
File: `PHASE4_P4.1_AUTHZ_SEAM.md` (D1)
Issue: Adapters could map unknown errors to allow by mistake.
Fix: Law.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | Added (pass 2). |
| R1-F2 | fixed | D5 added with the honest dependency (pass 2). |
| R1-F3 | fixed | L2 added (pass 2). |

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
