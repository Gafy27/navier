# P3.2 Pending messages and promotion without a lost start: pending rows unchanged; graceful stop from rows; promoted turn enqueued inside the close transaction

Status: BINDING through pass 1
Depends on: product contract [`README.md`](../../README.md); [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) A15, A16; [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) D3; [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) D1.
Program: [`PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md`](PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md). Review: [`reviews/PHASE3_P3.2_PENDING_PROMOTION_REVIEW.md`](reviews/PHASE3_P3.2_PENDING_PROMOTION_REVIEW.md).
Sources: `navier/runtime/pending.ts:16-230`; `navier/runtime/close.ts:150-202`; `navier/runtime/activities.ts:159-179`.

## Design explained

**Kept (D1 context).** A user message posted while an agent message is `created` or `paused` becomes a `pending_message` row (`navier/runtime/pending.ts:30-50`, `navier/runtime/pending.ts:77-108`); at close the newest pending plan is promoted into a new agent message at the top rank or dropped (`navier/runtime/close.ts:150-202`). That is product behaviour and stays as is.

**Promoted start (D1).** Today `finishTurn` starts the promoted message after its close committed, and a failed start falls to the reaper (`navier/runtime/activities.ts:159-179`). On DBOS, `closeTurn` runs inside the `finishTurn` step's transaction and, when it mints a promoted message, calls `TurnRunner.start(tx, ref)` — the SQL enqueue of [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) — in the **same** transaction. The close and the start commit together; a re-run of the step finds the CAS lost and enqueues nothing new (and a duplicate enqueue is a no-op by id anyway). This is a SQL write from inside a step, not a DBOS API call, so the "steps cannot start workflows" rule is not violated [Doc].

**Graceful (D2).** The pending arm of `startTurn` signalled `graceful_stop` (`navier/runtime/start.ts:140-155`); on DBOS it does nothing — `checkStop` reads open pending rows at the next boundary ([P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) D3).

**Partition (D3).** The promoted turn is on the same thread partition; it becomes runnable when the finishing workflow returns and frees the slot ([P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) D2).

## Context and scope

Audit rows A15, A16.

## Goals and non-goals

**Goals**

- **G1 —** No lost promoted start.
- **G2 —** Pending semantics unchanged.

**Non-goals**

- Changing ranks, plans or drop reasons.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Pending rows | queued posts | unchanged | pending.ts |
| Promotion | close tx | mint + enqueue | close.ts, [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) |
| Graceful | boundary read | no wake | [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) |

## Decisions and rationale

### D1 — Promoted turn enqueued in the close transaction

SQL enqueue from `closeTurn` via `TurnRunner.start(tx, ref)`. [pass 1]

### D2 — No graceful wake on DBOS

`checkStop` reads pending rows. [pass 1]

### D3 — Same partition

Runs after the finishing workflow frees the slot. [pass 1]

## Invariants

- **L1 —** A promoted agent message is never committed without its workflow. [pass 1]

## Relevant cross-cutting concerns

Authz: promotion re-checks the plan with `acceptTurn` (unchanged); the check path moves to authz-engine in [P4.3](../phase-4/PHASE4_P4.3_WORKFLOW_AUTHZ.md).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | D1, D2, D3, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE3_P3.2_PENDING_PROMOTION_REVIEW.md#round-1) — VERDICT ready. | D1: enqueue from workflow code after finish — a crash between finish and enqueue needs a sweep; D2: send a graceful message — needs a wake for a boundary-only action | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
