# P2.5 Atomic start, exactly-once writes, versioning and the replay-test replacement — program design

Status: BINDING through pass 2
Architecture: [`PHASE2_P2.5_EXACTLY_ONCE.md`](PHASE2_P2.5_EXACTLY_ONCE.md) (BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04).
Depends on: [P2.5](PHASE2_P2.5_EXACTLY_ONCE.md) architecture.
Tickets: [`PHASE2_P2.5_EXACTLY_ONCE_TICKETS.md`](PHASE2_P2.5_EXACTLY_ONCE_TICKETS.md). Review: [`reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md`](reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Spike first](#pd1--spike-first) |
| PD2 | [One start function](#pd2--one-start-function) |
| PD3 | [Tests separate](#pd3--tests-separate) |

## Implementation explained

Ticket 1 is the B1 spike; its result picks the start implementation (PD1). Start is used by every start site through `TurnRunner.start` (PD2). Tests land as their own ticket (PD3).

## Types, signatures, and caller contracts

```ts
// src/runner/dbos/start.ts
export async function enqueueTurn(tx: Tx, ref: TurnRef, input: DbosTurnInput, version: string): Promise<Result<void>>;
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `start.ts` | SQL call |
| D2 | DBOS | ON CONFLICT |
| D6 | `register.ts` | `applicationVersion` from config |
| D7 | `test/dbos/*` | tests |

[pass 1]

## Landing decisions

### PD1 — Spike first

If the spike fails, implement fallback B; if B2 fails, C. [pass 2]

### PD2 — One start function

All start sites. [pass 1]

### PD3 — Tests separate

Kill, patch, fork. [pass 1]

## Unresolved questions and blockers

Architecture carries open findings R3-F1, R3-F2; this program does not resolve them and names the ticket that must stop and report if it hits one.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, PD3, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: implement all three — dead code | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | PD1 | Review fixes for R1-F1 ([round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready |
