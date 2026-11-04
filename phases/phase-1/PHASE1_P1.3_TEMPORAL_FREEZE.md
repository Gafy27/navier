# P1.3 Temporal as a frozen adapter: move Temporal code under `src/runner/temporal/` unchanged; frozen = compiles and passes its own tests

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P0.2](../phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md), [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md), [P1.2](PHASE1_P1.2_OPERATIONS_PORT.md).
Program: [`PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM.md`](PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM.md). Review: [`reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md`](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md).
Sources: research [temporal-surface](../phase-0/indexing/temporal-surface.md).

## Design explained

**Move (D1).** These files move under `src/runner/temporal/` with no logic change: `temporal/*` (`navier/temporal/worker.ts:50-92` et al.), `runtime/workflow.ts` (`navier/runtime/workflow.ts:1-59`), `runtime/turn-loop.ts` (`navier/runtime/turn-loop.ts:1-228`), the activity wrapper `runtimeActivities` (`navier/runtime/activities.ts:186-257`), `runtime/reaper.ts` (`navier/runtime/reaper.ts:1-524`), `runtime/schedule.ts` (`navier/runtime/schedule.ts:1-56`) and the Temporal schedule half of `stream-sweep.ts` (`navier/runtime/stream-sweep.ts:57-95`). The SQL half of the sweep stays in `runtime/` for DBOS to reuse ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md)).

**Frozen (D2)** means: typechecks, its own tests (including the replay test, `navier/temporal/replay.test.ts:1-33`) pass, and the shared harness ([P1.5](PHASE1_P1.5_SHARED_HARNESS.md)) passes on it. Nothing more — no features, no refactors, no dependency bumps beyond what keeps it compiling.

**Step guard (D3).** `step_claim` (`navier/runtime/model-step.ts:210-249`) is the only Temporal compensation inside a runner-neutral step. It moves behind an optional `StepGuard` dependency of `modelStep`: the Temporal adapter passes the claim-based guard (identical behaviour); the DBOS runner passes none ([P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md)).

**Retirement (D4).** The adapter is deleted when no non-terminal turn is owned by Temporal for 14 consecutive days and the owner signs off; deletion is one folder, the Temporal config branch and the `StepGuard` parameter ([P7.4](../phase-7/PHASE7_P7.4_DEAD_CODE.md)).

**Bugs (D5).** A Temporal bug is fixed only if it blocks draining.

## Context and scope

Owner decision 1.

## Goals and non-goals

**Goals**

- **G1 —** Temporal behaviour identical during the drain.
- **G2 —** Retirement is a pure deletion.

**Non-goals**

- Improving the Temporal path.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Move | D1 | folder | imports from `runtime/` only |
| Freeze | D2 | definition | CI |
| StepGuard | D3 | optional dep | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| Retirement | D4 | criterion | [P5.1](../phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md) |

## Decisions and rationale

### D1 — Move list

As above; no logic change. [pass 2]

### D2 — Frozen = compiles + own tests + harness

No other work. [pass 1]

### D3 — `StepGuard` injection

Claim-based guard passed only by Temporal. [pass 1]

### D4 — Retirement criterion

14 days without a non-terminal Temporal turn + owner sign-off. [pass 1]

### D5 — Bug policy

Fix only drain blockers. [pass 1]

## Invariants

- **L1 —** Nothing outside `src/runner/temporal/` imports from it except the composition roots. [pass 2]

## Relevant cross-cutting concerns

Replay tests keep running here until retirement.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: leave files in place — no clean deletion; D3: keep step_claim for both — wasted write per step on DBOS; D4: retire at cutover day — paused Temporal turns can live for the pause timeout | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md#round-1); new L1 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
