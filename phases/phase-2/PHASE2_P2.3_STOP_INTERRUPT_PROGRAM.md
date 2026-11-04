# P2.3 Stop, interrupt and graceful stop on DBOS — program design

Status: BINDING through pass 1
Architecture: [`PHASE2_P2.3_STOP_INTERRUPT.md`](PHASE2_P2.3_STOP_INTERRUPT.md) (BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04).
Depends on: [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md) architecture.
Tickets: [`PHASE2_P2.3_STOP_INTERRUPT_TICKETS.md`](PHASE2_P2.3_STOP_INTERRUPT_TICKETS.md). Review: [`reviews/PHASE2_P2.3_STOP_INTERRUPT_PROGRAM_REVIEW.md`](reviews/PHASE2_P2.3_STOP_INTERRUPT_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [Two SQL statements](#pd1--two-sql-statements) |
| PD2 | [Hub on createListener](#pd2--hub-on-createlistener) |
| PD3 | [checkStop runner-neutral](#pd3--checkstop-runner-neutral) |

## Implementation explained

`wake.ts` holds the two SQL statements used in API transactions (PD1). `stop-hub.ts` wraps `createListener` (PD2). `checkStop` is a runner-neutral step (PD3).

## Types, signatures, and caller contracts

```ts
export async function sendTurnMessage(tx: Tx, workflowId: string, kind: 'stop' | 'resume', idempotencyKey: string): Promise<void>;
export interface StopHub { register(workflowId: string): { signal: AbortSignal; release(): void }; close(): Promise<void> }
export function createStopHub(db: Db, listen: ListenerFactory, log: Logger): StopHub;
// src/runtime/steps.ts
checkStop(args: { org: OrgId; agentMessageId: string; threadId: string }): Promise<Result<'none' | StopKind | 'graceful'>>;
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `wake.ts` | send + notify SQL |
| D2 | `stop-hub.ts` | map + listener |
| D3 | `steps.ts` | checkStop |
| L1 | `workflow.ts` | stop precedence in the wait |

[pass 1]

## Landing decisions

### PD1 — Two SQL statements

`dbos.send_message(...)` and `pg_notify(...)`, parameterised. [pass 1]

### PD2 — Hub on createListener

Reconnect callback re-reads rows. [pass 1]

### PD3 — checkStop runner-neutral

Lives with the other steps. [pass 1]

## Unresolved questions and blockers

Architecture carries open findings R3-F1, R3-F2; this program does not resolve them and names the ticket that must stop and report if it hits one.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, PD3, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE2_P2.3_STOP_INTERRUPT_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: DBOSClient.send after commit — not atomic | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
