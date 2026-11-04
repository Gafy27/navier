# P3.2 Pending messages and promotion without a lost start — program design

Status: BINDING through pass 2
Architecture: [`PHASE3_P3.2_PENDING_PROMOTION.md`](PHASE3_P3.2_PENDING_PROMOTION.md) (BINDING through pass 1).
Depends on: [P3.2](PHASE3_P3.2_PENDING_PROMOTION.md) architecture.
Tickets: [`PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md`](PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md). Review: [`reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md`](reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Hook, not import](#pd1--hook-not-import) |

## Implementation explained

`closeTurn` takes an optional `onPromoted(tx, ref)` hook (PD1); the DBOS runner passes `start`; the Temporal adapter passes none and keeps `startPromoted`.

## Types, signatures, and caller contracts

```ts
export async function closeTurn(tx: Tx, org: OrgId, args: CloseArgs, onPromoted?: (tx: Tx, ref: TurnRef) => Promise<Result<void>>): Promise<Result<ClosedTurn>>;
```

[pass 2]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `runtime/close.ts` | hook call after mint |
| D2 | `runtime/start.ts` | owner `wakeStop(graceful)` is a no-op on DBOS |
| L1 | hook in the same tx | commit together |

[pass 1]

## Landing decisions

### PD1 — Hook, not import

close.ts stays runner-neutral. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | — | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | types | Review fixes for R1-F1 ([round 1](reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | PD1: import the DBOS runner into close.ts — breaks L1 of [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) | [review round 1](reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md#round-1); new PD1 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
