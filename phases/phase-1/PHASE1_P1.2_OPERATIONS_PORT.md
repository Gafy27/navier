# P1.2 Port every runner call site to the interface: start, stop, decide, edit/retry, promoted start, awaitTurn and composition roots use `TurnRunner`

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md).
Program: [`PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md`](PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md). Review: [`reviews/PHASE1_P1.2_OPERATIONS_PORT_REVIEW.md`](reviews/PHASE1_P1.2_OPERATIONS_PORT_REVIEW.md).
Sources: research [runner-call-sites](indexing/runner-call-sites.md).

## Design explained

| Site | Today | After |
|------|-------|-------|
| `startTurn` / `startCommitted` | `navier/runtime/start.ts:83-179` | `runners.forStart(org).start(tx, ref)` inside the post transaction |
| edit / retry / replay retry | `navier/runtime/revise.ts:189-197`, `navier/runtime/revise.ts:224-246`, `navier/runtime/revise.ts:332-339` | same, inside their transactions |
| promoted start | `navier/runtime/activities.ts:163-179` | the runner that finishes the turn starts the promoted one (DBOS: workflow code, [P3.2](../phase-3/PHASE3_P3.2_PENDING_PROMOTION.md); Temporal: unchanged) |
| pending arm graceful signal | `navier/runtime/start.ts:140-155` | `owner.wakeStop(tx, ref, graceful)` (DBOS: no-op, the boundary step reads rows) |
| `requestStop` | `navier/runtime/stop.ts:64-140` | row insert unchanged + `owner.wakeStop(tx, ref, kind)` in the same tx |
| `decide` restart | `navier/runtime/decide.ts:514-533` | `owner.wakeDecision(tx, ref, key)` in the decision tx |
| `awaitTurn` | `navier/sdk/turn.ts:180-225` | `owner.awaitEnd(ref, signal)` |
| composition | `navier/worker.ts:142-189`, `navier/api.ts:104-130`, `navier/sdk/runtime.ts:130-160` | build `Runners` from config ([P1.4](PHASE1_P1.4_RUNNER_CONFIG.md)) |
| chat routes | `navier/api/routes/chat/handler.ts:95-120` | deps type only |

`Runners` is a two-field object `{ dbos?, temporal? }` plus `forStart(org)` and `ownerOf(tx, ref)` (D1). Domain functions stop importing `TemporalHandle`; their deps carry `runners` (D2). The Temporal adapter implements the operations with the code it has today, so behaviour is unchanged while only Temporal is configured (D3).

## Context and scope

Today deps objects carry `temporal: TemporalHandle` (`navier/runtime/start.ts:20-27`, `navier/runtime/stop.ts:26-31`, `navier/runtime/decide.ts:42-48`).

## Goals and non-goals

**Goals**

- **G1 —** No call site keeps a Temporal type.
- **G2 —** With `RUNNER=temporal` every test passes unchanged.

**Non-goals**

- DBOS behaviour ([Phase 2](../phase-2/README.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| `Runners` | which runner for start / owner for wake | `forStart`, `ownerOf` | [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) D4, [P1.4](PHASE1_P1.4_RUNNER_CONFIG.md) |
| Domain deps | runner reference | `runners` field | start/stop/decide |
| Composition roots | construction | worker, api, sdk | [P1.4](PHASE1_P1.4_RUNNER_CONFIG.md) |

## Decisions and rationale

### D1 — `Runners` object

`{ dbos?, temporal? }` with `forStart(org)` and `ownerOf(tx, ref)`. [pass 1]

### D2 — Deps carry `runners`

Replace `temporal: TemporalHandle` in StartDeps, StopDeps, DecideDeps, RuntimeActivityDeps and SDK deps. [pass 1]

### D3 — Temporal-only config is a no-op refactor

Same tests, same rows, same signals. [pass 1]

## Relevant cross-cutting concerns

Errors: a missing runner for an owner is `unavailable` (fail closed, retryable).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE1_P1.2_OPERATIONS_PORT_REVIEW.md#round-1) — VERDICT ready. | D1: a registry keyed by string — two runners only; D2: global singleton — untestable | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
