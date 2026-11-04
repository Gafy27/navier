# P4.5 architecture review — Removal of the old gRPC authz client

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.5_GRPC_REMOVAL.md`](../PHASE4_P4.5_GRPC_REMOVAL.md) (kind `architecture`), passes 1–2.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 2 of max 3.
**Sibling interfaces read:** [P7.4](../../phase-7/PHASE7_P7.4_DEAD_CODE.md).

Verdict: **ready** (round 2). Architecture/program marked BINDING under owner request (pt151u) after this verdict.

## Round 1

Pass reviewed: 1. VERDICT: **fix-then-ready**.

```
VERDICT: fix-then-ready
BLOCKER  D1 — service-token listed for deletion — evidence: PHASE4_P4.5_GRPC_REMOVAL.md — fix: Keep it
```

### R1-F1. service-token listed for deletion

[HIGH] service-token listed for deletion
File: `PHASE4_P4.5_GRPC_REMOVAL.md` (D1)
Issue: Pass 1 deleted `service-token.ts`, which the CLI imports.
Fix: Keep it.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | D3 added (pass 2). |

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
