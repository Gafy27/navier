# P2.4 Approval and pause as a durable wait — program design

Status: BINDING through pass 1
Architecture: [`PHASE2_P2.4_APPROVAL_PAUSE.md`](PHASE2_P2.4_APPROVAL_PAUSE.md) (BINDING through pass 2).
Depends on: [P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md) architecture.
Tickets: [`PHASE2_P2.4_APPROVAL_PAUSE_TICKETS.md`](PHASE2_P2.4_APPROVAL_PAUSE_TICKETS.md). Review: [`reviews/PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM_REVIEW.md`](reviews/PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [One wait function](#pd1--one-wait-function) |
| PD2 | [decide owner check](#pd2--decide-owner-check) |

## Implementation explained

`wait.ts` implements the outcome table (PD1). decide calls `runners.ownerOf` then `sendTurnMessage(resume)` in its tx (PD2).

## Types, signatures, and caller contracts

```ts
export type TurnMessage = { kind: 'resume' } | { kind: 'stop' };
export async function waitForDecision(paused: { pausedSeq: number; expiresAtEpochMs: number }): Promise<'resume' | StopKind | 'expired'>;
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D2 | `wait.ts` | recv |
| D3 | `runtime/decide.ts` | send in tx |
| D4 | `wait.ts` | CAS + re-wait |
| L1 | `closeTurn` CAS | DB clock |

[pass 1]

## Landing decisions

### PD1 — One wait function

Pure control flow over recv and steps. [pass 1]

### PD2 — decide owner check

Temporal-owned turns keep the restart path in the frozen adapter. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD2: send to both runners — Temporal has no listener | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
