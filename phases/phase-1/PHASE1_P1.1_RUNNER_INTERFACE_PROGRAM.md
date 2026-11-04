# P1.1 Runner interface and runner-neutral steps — program design

Status: BINDING through pass 1
Architecture: [`PHASE1_P1.1_RUNNER_INTERFACE.md`](PHASE1_P1.1_RUNNER_INTERFACE.md) (BINDING through pass 2).
Depends on: [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) architecture.
Tickets: [`PHASE1_P1.1_RUNNER_INTERFACE_TICKETS.md`](PHASE1_P1.1_RUNNER_INTERFACE_TICKETS.md). Review: [`reviews/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM_REVIEW.md`](reviews/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM_REVIEW.md).

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
| PD1 | [Steps return `Result`](#pd1--steps-return-result) |
| PD2 | [Owner lookup inside the caller's tx](#pd2--owner-lookup-inside-the-callers-tx) |

## Implementation explained

Three files. `types.ts` declares the interface; `steps.ts` re-exports today's activity bodies with `Result` returns (PD1); `owner.ts` holds the one SQL lookup (PD2).

## Types, signatures, and caller contracts

```ts
// src/runner/types.ts
export interface TurnRef { readonly org: OrgId; readonly threadId: string; readonly agentMessageId: string; readonly traceId?: string }
export const StopWake = { cancel: 'cancel', interrupt: 'interrupt', graceful: 'graceful' } as const;
export interface TurnRunner {
  readonly name: 'dbos' | 'temporal';
  start(tx: Tx, ref: TurnRef): Promise<Result<void>>;            // idempotent per workflow id
  wakeStop(tx: Tx, ref: TurnRef, kind: StopWake): Promise<Result<void>>;
  wakeDecision(tx: Tx, ref: TurnRef, key: string): Promise<Result<void>>;
  awaitEnd(ref: TurnRef, signal: AbortSignal): Promise<Result<MessageStatus>>;
  probe(): ReadinessProbe;
  close(): Promise<void>;
}
// src/runtime/steps.ts
export interface TurnSteps {
  loadTurn(input: TurnWorkflowInput): Promise<Result<LoadedTurn>>;
  modelStep(args: ModelStepArgs, signal: AbortSignal): Promise<Result<ModelStepResult>>;
  toolCall(args: ToolCallArgs, signal: AbortSignal): Promise<Result<ToolCallResult>>;
  failAction(args: FailActionArgs): Promise<Result<void>>;
  pauseTurn(args: PauseArgs): Promise<Result<PausedTurn>>;
  finishTurn(args: FinishArgs): Promise<Result<ClosedTurn>>;
}
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `src/runner/types.ts` | interface |
| D2 | `src/runtime/steps.ts` | wraps existing bodies |
| D3 | each runner | tx use |
| D4 | `src/runner/owner.ts` | one `SELECT 1 FROM dbos.workflow_status WHERE workflow_uuid = $1` |
| L1 | `commands.deps` rule | banned import |

[pass 1]

## Program layout and construction

```text
src/runner/types.ts
src/runner/owner.ts
src/runtime/steps.ts
```

[pass 1]

## Call graph and execution flow

route → domain (post/stop/decide) → `runnerFor(tx, ref)` → `TurnRunner.*`. [pass 1]

## Test seams

Fake `TurnRunner` recording calls for domain unit tests. [pass 1]

## Call sites and integration

[P1.2](PHASE1_P1.2_OPERATIONS_PORT.md) ports every site. [pass 1]

## Landing decisions

### PD1 — Steps return `Result`

Runners map `Result` errors to retry/no-retry with today's `failure` table (`navier/runtime/activities.ts:89-103`). [pass 1]

### PD2 — Owner lookup inside the caller's tx

One indexed read on the DBOS primary key; no cache. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, types, owners, layout, callgraph, seams, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: throwing steps — loses the retryable flag; PD2: cache ownership in memory — wrong across processes | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
