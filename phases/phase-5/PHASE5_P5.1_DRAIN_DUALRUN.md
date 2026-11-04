# P5.1 Drain and dual-run: both runners live; ownership by row lookup; Temporal turns finish on Temporal

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md), [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md), [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md).
Program: [`PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM.md`](PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM.md). Review: [`reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md`](reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md).
Sources: research [drain-inputs](indexing/drain-inputs.md).

## Design explained

**Dual-run (D1).** During the drain the worker process (or two deployments) runs the DBOS executor, the Temporal worker and the Temporal reaper schedule (`navier/runtime/schedule.ts:19-56`). The API constructs both runners ([P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) D3). `start` uses `forStart(org)`; `wakeStop`, `wakeDecision`, `awaitEnd` use `ownerOf(tx, ref)` ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4).

**No move (D2).** A Temporal turn — running, paused or being restarted by the reaper — finishes on Temporal. Paused Temporal turns resume through the frozen decide-restart path; they are bounded by their `pauseTimeout` (`navier/agents/limits.ts:13-28`).

**Promoted turns (D3).** A Temporal turn that promotes a pending message starts it on Temporal (frozen `startPromoted`); the promoted turn drains like any other. Only new posts start on DBOS.

**End (D4).** Drain ends when `SELECT count(*)` of agent messages whose newest status is `created`/`paused` and that have no `dbos.workflow_status` row is 0; this query is the [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4 retirement metric.

**Audit sweep (D5).** The DBOS sweep ignores Temporal-owned rows ([P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) D1); the Temporal reaper ignores DBOS-owned rows (its `hasOpenExecution` check sees no Temporal execution, so the frozen reaper must skip rows with a DBOS workflow — the one behaviour edit allowed in the frozen adapter, as a drain blocker per [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D5).

## Context and scope

Owner decision 5: drain, do not migrate.

## Goals and non-goals

**Goals**

- **G1 —** No turn changes runner mid-life.
- **G2 —** Drain end is measurable.

**Non-goals**

- Moving histories.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Composition | both runners | one worker | [P1.4](../phase-1/PHASE1_P1.4_RUNNER_CONFIG.md) |
| Routing | owner lookup | wakes | [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) |
| Metric | drain count | query | retirement |
| Reaper guard | skip DBOS rows | frozen edit | [P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D5 |

## Decisions and rationale

### D1 — Dual-run composition

DBOS + Temporal worker + reaper. [pass 2]

### D2 — No move

Temporal turns finish on Temporal. [pass 1]

### D3 — Promoted on the same runner

Temporal promotes on Temporal. [pass 1]

### D4 — Drain end query

Zero Temporal-owned open messages. [pass 1]

### D5 — Reaper skips DBOS rows

Only frozen-adapter edit, a drain blocker. [pass 2]

## Relevant cross-cutting concerns

Metrics: drain count per org ([P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md#round-1) — VERDICT fix-then-ready. | D2: re-enqueue paused turns on DBOS — second resume implementation | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md#round-2) — VERDICT ready. | D5: let the Temporal reaper see DBOS rows — it would restart them on Temporal | [review round 1](reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md#round-1); new D5 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
