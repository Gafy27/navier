# P4.4 program review — Migration and cutover from the old authz service

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md`](../PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md) (kind `program`), passes 1–3; read against BINDING architecture [`PHASE4_P4.4_AUTHZ_CUTOVER.md`](../PHASE4_P4.4_AUTHZ_CUTOVER.md).
**Not reviewed:** the anexo (on request only) and architecture clauses this program does not land.
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P5.2](../../phase-5/PHASE5_P5.2_ROLLOUT_FLAGS.md) program.

Verdict: **not-ready** (round 3). Not ready after round 3; BINDING recorded under owner request (pt151u) with unresolved R3-F1, R3-F2.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  PD2 — Outbox contradicts "keep current tables" — evidence: PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md — fix: Justify as temporary and drop with the legacy client
```

### R1-F1. Outbox contradicts "keep current tables"

[HIGH] Outbox contradicts "keep current tables"
File: `PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md` (PD2)
Issue: Owner decision 5 says keep current tables; a new table needs justification.
Fix: Justify as temporary and drop with the legacy client.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | PD2 states it is temporary and dropped by [P4.5](../PHASE4_P4.5_GRPC_REMOVAL.md) (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  owners — Markings parity unverified — evidence: PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md — fix: Add a parity check at import
```

### R2-F1. Markings parity unverified

[HIGH] Markings parity unverified
File: `PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md` (owners)
Issue: Deny-layer semantics may differ from legacy markings; zero diffs on sampled checks does not prove parity on unsampled objects.
Fix: Add a parity check at import.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | PD3 added (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  PD3 — Parity check depends on unknown `@deny` semantics — evidence: PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md — fix: Resolve B1 first
MAJOR    callgraph — ListGrants completeness for export — evidence: PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md — fix: Cross-check counts with authz-api operators
```

### R3-F1. Parity check depends on unknown `@deny` semantics

[HIGH] Parity check depends on unknown `@deny` semantics
File: `PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md` (PD3)
Issue: PD3 cannot be specified until [P4.2](../PHASE4_P4.2_NAVIER_MODEL.md) B1 is resolved.
Fix: Resolve B1 first.

### R3-F2. ListGrants completeness for export

[MEDIUM] ListGrants completeness for export
File: `PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md` (callgraph)
Issue: Whether `listGrants` pages return every tuple including inherited structure is [U].
Fix: Cross-check counts with authz-api operators.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | deferred | Blocked on authz-engine P1.1; flip of any org with markings waits for it. Open. |
| R3-F2 | deferred | Owned by the export ticket; open until verified against a staging export. |
