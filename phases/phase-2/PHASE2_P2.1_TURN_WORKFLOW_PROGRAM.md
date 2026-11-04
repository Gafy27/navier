# P2.1 The DBOS turn workflow — program design

Status: BINDING through pass 2
Architecture: [`PHASE2_P2.1_TURN_WORKFLOW.md`](PHASE2_P2.1_TURN_WORKFLOW.md) (BINDING through pass 2).
Depends on: [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) architecture; [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) program.
Tickets: [`PHASE2_P2.1_TURN_WORKFLOW_TICKETS.md`](PHASE2_P2.1_TURN_WORKFLOW_TICKETS.md). Review: [`reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md`](reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| Test seams | [Test seams](#test-seams) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Register before launch](#pd1--register-before-launch) |
| PD2 | [awaitEnd via event then result](#pd2--awaitend-via-event-then-result) |
| PD3 | [Lint for determinism](#pd3--lint-for-determinism) |

## Implementation explained

`register.ts` registers the queue and workflow once at worker boot before `DBOS.launch()` (PD1). `adapter.ts` implements `TurnRunner` for DBOS; `start` is [P2.5](PHASE2_P2.5_EXACTLY_ONCE.md), wakes are [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md)/[P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md), `awaitEnd` uses `getEvent(status)` then `getResult` (PD2).

## Types, signatures, and caller contracts

```ts
// src/runner/dbos/workflow.ts
export interface DbosTurnInput { org: OrgId; threadId: string; agentMessageId: string; traceId?: string; service: ServiceLimits }
export const turnWorkflow: (input: DbosTurnInput) => Promise<MessageStatus>;   // DBOS.registerWorkflow(impl, { name: 'navier.turn', maxRecoveryAttempts })
// src/runner/dbos/queue.ts
export const TURN_QUEUE = 'turns';
export function partitionKey(org: OrgId, threadId: string): string;            // `${org}~${threadId}`
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `workflow.ts` | registration name + id fn |
| D2 | `queue.ts` | `registerQueue(TURN_QUEUE, { partitionQueue: true, partitionConcurrency: 1, workerConcurrency })` |
| D4 | `workflow.ts` | try/catch around the loop |
| L2 | `workflow.ts` types | input/output types are ids/enums |
| L3 | lint rule | no `Date`, `Math.random`, `process.env` in `workflow.ts` |

[pass 2]

## Program layout and construction

```text
src/runner/dbos/workflow.ts
src/runner/dbos/queue.ts
src/runner/dbos/register.ts
src/runner/dbos/adapter.ts
src/runner/dbos/index.ts
```

[pass 1]

## Call graph and execution flow

worker boot → register → `DBOS.launch()` → queue dequeues → `turnWorkflow` → `TurnSteps` via `runStep`. [pass 1]

## Test seams

Fake `TurnSteps` for workflow unit tests with DBOS on a disposable Postgres. [pass 1]

## Call sites and integration

Worker composition ([P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md)); adapter from `Runners` ([P1.2](../phase-1/PHASE1_P1.2_OPERATIONS_PORT.md)). [pass 1]

## Landing decisions

### PD1 — Register before launch

Queue and workflow registered in `register.ts`; `launch` after. [pass 1]

### PD2 — awaitEnd via event then result

`getEvent(id, "status", { timeoutSeconds })` loop until terminal, then `retrieveWorkflow(id).getResult()`. [pass 1]

### PD3 — Lint for determinism

An `rg` ban in tickets until a lint rule exists. [pass 2]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, types, owners, layout, callgraph, seams, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD2: poll message_status rows — load | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | owners | Review fixes for R1-F1 ([round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md#round-1); new PD3 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
