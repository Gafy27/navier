# P2.5 architecture review — Atomic start, exactly-once writes, versioning and the replay-test replacement

**Status: draft.** Review, not a binding spec.
**Reviewed:** [`PHASE2_P2.5_EXACTLY_ONCE.md`](../PHASE2_P2.5_EXACTLY_ONCE.md) (kind `architecture`), passes 1–3.
**Not reviewed:** the program sibling and the anexo (anexo review is on request only).
**Reviewer:** `spec-reviewer`, one fresh session per round, never the designer. **Rounds used:** 3 of max 3.
**Sibling interfaces read:** [P3.1](../../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md), [P5.1](../../phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md), [P7.1](../../phase-7/PHASE7_P7.1_TEST_MATRIX.md).

Verdict: **not-ready** (round 3). Not ready after round 3; BINDING recorded under owner request (pt151u) with unresolved R3-F1, R3-F2.

## Round 1

Pass reviewed: 1. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D1 — Fallback B needs the raw client — evidence: PHASE2_P2.5_EXACTLY_ONCE.md — fix: Record the unknown and a third fallback
```

### R1-F1. Fallback B needs the raw client

[HIGH] Fallback B needs the raw client
File: `PHASE2_P2.5_EXACTLY_ONCE.md` (D1)
Issue: enqueueInTransaction takes a `pg` ClientBase; Navier's transactions are Kysely.
Fix: Record the unknown and a third fallback.

### Round 1 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R1-F1 | fixed | B2 and fallback C added (pass 2). |

## Round 2

Pass reviewed: 2. VERDICT: **not-ready**.

```
VERDICT: not-ready
MAJOR    D7 — Fork test scope — evidence: PHASE2_P2.5_EXACTLY_ONCE.md — fix: Fork only on a copied database
MINOR    D6 — Which changes need a patch — evidence: PHASE2_P2.5_EXACTLY_ONCE.md — fix: State: any change in step order or count
```

### R2-F1. Fork test scope

[MEDIUM] Fork test scope
File: `PHASE2_P2.5_EXACTLY_ONCE.md` (D7)
Issue: Forking a workflow that already wrote rows would duplicate side effects on the real message.
Fix: Fork only on a copied database.

### R2-F2. Which changes need a patch

[LOW] Which changes need a patch
File: `PHASE2_P2.5_EXACTLY_ONCE.md` (D6)
Issue: Unclear.
Fix: State: any change in step order or count.

### Round 2 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R2-F1 | fixed | D7 says "on a copy" (pass 3). |
| R2-F2 | fixed | D6 states it (pass 3). |

## Round 3

Pass reviewed: 3. VERDICT: **not-ready**.

```
VERDICT: not-ready
BLOCKER  D1 — Primary path rests on an unverified serializer — evidence: PHASE2_P2.5_EXACTLY_ONCE.md — fix: Run the spike before BINDING
MAJOR    D1 — API role privilege on the dbos schema — evidence: PHASE2_P2.5_EXACTLY_ONCE.md — fix: Design grants
```

### R3-F1. Primary path rests on an unverified serializer

[HIGH] Primary path rests on an unverified serializer
File: `PHASE2_P2.5_EXACTLY_ONCE.md` (D1)
Issue: The chosen start path depends on B1; if it fails, the atomic-start claim of the whole redesign falls back to B or C.
Fix: Run the spike before BINDING.

### R3-F2. API role privilege on the dbos schema

[MEDIUM] API role privilege on the dbos schema
File: `PHASE2_P2.5_EXACTLY_ONCE.md` (D1)
Issue: The API role must call `dbos.*` functions; their SECURITY mode and grants are not designed here.
Fix: Design grants.

### Round 3 response

| # | Answer | Where / why / owner |
|---|--------|---------------------|
| R3-F1 | deferred | Spike is ticket 1 and gates the rest of the anexo; fallbacks are specified. Open. |
| R3-F2 | deferred | Owned by [P7.2](../../phase-7/PHASE7_P7.2_SECURITY_REVIEW.md). Open. |
