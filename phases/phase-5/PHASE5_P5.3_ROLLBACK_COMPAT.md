# P5.3 Rollback and compatibility: flag back for new turns; DBOS turns finish on DBOS; schema and API compatible both ways

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md), [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md).
Program: [`PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM.md`](PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM.md). Review: [`reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md`](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md).
Sources: `navier/runtime/migrations.ts:27-51`.

## Design explained

**Rollback (D1).** Move the org to `RUNNER_TEMPORAL_ORGS`. New turns start on Temporal; DBOS-owned turns finish on DBOS (their wakes still route by owner). DBOS workers stay up until the DBOS drain count is 0 for that org.

**Compatibility (D2).** No Navier migration was added by the runner work ([P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D1), so nothing needs to be undone; the `dbos` schema stays installed. The API, SSE stream and SDK see the same rows from both runners ([P1.5](../phase-1/PHASE1_P1.5_SHARED_HARNESS.md)).

**Hard rollback (D3).** If DBOS itself is unhealthy, operators may cancel DBOS-owned turns with the existing stop API (cancel) rather than stopping workers, so rows close cleanly.

**Version skew (D4).** Rolling back the **code** to a build without the DBOS runner is allowed only when the DBOS drain count is 0; otherwise DBOS turns would never finish.

## Context and scope

Owner decision 5.

## Goals and non-goals

**Goals**

- **G1 —** Rollback without data repair.

**Non-goals**

- Moving DBOS turns to Temporal.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Flag rollback | new turns | Temporal | [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) |
| Hard rollback | cancel via API | clean close | [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) |
| Code rollback | skew rule | guarded | drain metric |

## Decisions and rationale

### D1 — Flag rollback

DBOS turns finish on DBOS. [pass 2]

### D2 — Nothing to undo in schema

Both runners same rows. [pass 1]

### D3 — Hard rollback by cancel

Stop API. [pass 1]

### D4 — Code rollback only at zero DBOS drain

Skew rule. [pass 1]

## Relevant cross-cutting concerns

Runbook ([P5.4](PHASE5_P5.4_RUNBOOK.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: stop DBOS workers on rollback — strands turns; D3: DBOS.cancelWorkflow — no finish | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
