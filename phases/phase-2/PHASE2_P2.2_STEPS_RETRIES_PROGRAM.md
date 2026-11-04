# P2.2 Steps, retries, timeouts and the attempt source — program design

Status: BINDING through pass 1
Architecture: [`PHASE2_P2.2_STEPS_RETRIES.md`](PHASE2_P2.2_STEPS_RETRIES.md) (BINDING through pass 3).
Depends on: [P2.2](PHASE2_P2.2_STEPS_RETRIES.md) architecture.
Tickets: [`PHASE2_P2.2_STEPS_RETRIES_TICKETS.md`](PHASE2_P2.2_STEPS_RETRIES_TICKETS.md). Review: [`reviews/PHASE2_P2.2_STEPS_RETRIES_PROGRAM_REVIEW.md`](reviews/PHASE2_P2.2_STEPS_RETRIES_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [One wrapper per step](#pd1--one-wrapper-per-step) |
| PD2 | [Attempt read inside the step](#pd2--attempt-read-inside-the-step) |
| PD3 | [Pool as a plain function](#pd3--pool-as-a-plain-function) |

## Implementation explained

`steps.ts` wraps each `TurnSteps` call in `runStep` with its config (PD1); `attempt.ts` holds the one query (PD2); `pool.ts` the reservation pool (PD3).

## Types, signatures, and caller contracts

```ts
export function stepConfigs(limits: ServiceLimits): Record<'store' | 'model' | 'tool', StepConfig>;
export async function nextAttempt(tx: Reader, org: OrgId, actionId: string): Promise<number>;  // 1 + max(action_status.attempt)
export async function toolPool(ids: readonly string[], concurrency: number, run: (id: string) => Promise<'done' | 'blocked'>): Promise<boolean>;
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `steps.ts` | configs |
| D2 | `steps.ts` | `shouldRetry` |
| D4 | `attempt.ts` | query |
| D6 | `pool.ts` | reserveStep |

[pass 1]

## Landing decisions

### PD1 — One wrapper per step

Names `load`, `model:<i>`, `tool:<actionId>`, `check:<i>`, `pause:<n>`, `finish`. [pass 1]

### PD2 — Attempt read inside the step

Same transaction as the claim. [pass 1]

### PD3 — Pool as a plain function

Unit-testable without DBOS by injecting `reserve`. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, PD3, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE2_P2.2_STEPS_RETRIES_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: anonymous steps — unreadable in DBOS listings | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
