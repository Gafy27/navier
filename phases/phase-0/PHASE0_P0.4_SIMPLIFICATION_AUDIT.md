# P0.4 Simplification audit of the machinery around the turn workflow: keep / replace-by-DBOS / delete / simplify, one row per piece, with the reason

Status: BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04
Depends on: product contract [`README.md`](../../README.md); [P0.1](PHASE0_P0.1_CURRENT_STATE_MAP.md), [P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md), [P0.3](PHASE0_P0.3_DBOS_FIT.md).
Program: [`PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md`](PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md). Review: [`reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md`](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md).
Sources: research [turn-lifecycle](indexing/turn-lifecycle.md), [temporal-surface](indexing/temporal-surface.md), [dbos-sdk-surface](indexing/dbos-sdk-surface.md).

## Design explained

**Rule (D1).** Minimum: a piece whose only job is to cover a Temporal gap that DBOS closes is deleted on the DBOS path; a piece that implements product behaviour is kept; a piece that DBOS does natively is replaced; anything else is simplified. The frozen Temporal adapter keeps every piece until it is retired ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md)).

**Verdict table (D2).**

| # | Piece | Where | Verdict | Why | Owner |
|---|-------|-------|---------|-----|-------|
| A1 | Temporal workflow + activities | `navier/runtime/workflow.ts:25-37`, `navier/runtime/activities.ts:186-257` | replace-by-DBOS | DBOS workflow + steps | [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| A2 | Signals cancel/interrupt | `navier/runtime/workflow.ts:20-22` | replace-by-DBOS | stop row + `send_message` in the same tx + in-step abort hub | [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) |
| A3 | Signal graceful_stop | `navier/runtime/stop.ts:38-56` | delete | boundary step reads the stop row and open pending rows | [P2.3](../phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) |
| A4 | Cancellation scopes / nonCancellable | `navier/runtime/turn-loop.ts:192-228` | simplify | workflow catches all and always runs the finish step | [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| A5 | continue-as-new + `MAX_HISTORY_LENGTH` | `navier/runtime/turn-loop.ts:79-87` | delete | no history limit; `maxSteps` bounds steps | [P2.1](../phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) |
| A6 | Start after commit + reaper lost-start | `navier/runtime/start.ts:83-112` | delete | enqueue inside the same transaction | [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) |
| A7 | Reaper restart of dead turns | `navier/runtime/reaper.ts:272-306` | replace-by-DBOS | executor recovery | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| A8 | `recovery` table + `maxRecoveries` | `navier/runtime/reaper.ts:194-226` | replace-by-DBOS | `maxRecoveryAttempts` (D3) | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| A9 | Reaper pause-expiry pass | `navier/runtime/reaper.ts:388-512` | delete | `recv` deadline in the live workflow | [P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) |
| A10 | Reaper as a whole | `navier/runtime/reaper.ts:336-357` | simplify | one small scheduled **turn audit sweep** closes rows whose workflow is terminal (D4) | [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| A11 | `START_GRACE_MS` | `navier/config.ts:11-18` | delete | no start race when start is transactional | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| A12 | `step_claim` | `navier/runtime/model-step.ts:210-249` | delete (DBOS path) | step checkpoint + guarded commit (D5) | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| A13 | Guarded commit / `appendIfNewest` | `navier/db/append.ts:42-75` | keep | the exactly-once write rule | [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) |
| A14 | decide restart | `navier/runtime/decide.ts:514-533` | delete | decision is a `send_message` | [P2.4](../phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) |
| A15 | Pending queue + promotion | `navier/runtime/close.ts:150-202`, `navier/runtime/pending.ts:77-140` | keep | product behaviour (queued user messages) | [P3.2](../phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) |
| A16 | Promoted start in finishTurn | `navier/runtime/activities.ts:163-179` | simplify | workflow enqueues the promoted turn after its finish step | [P3.2](../phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) |
| A17 | Conversation advisory lock, step plan | `navier/runtime/lock.ts:9-17`, `navier/runtime/step-plan.ts:1-24` | keep | serialises posts and plans; runner-neutral | — |
| A18 | Stream sweep | `navier/runtime/stream-sweep.ts:25-45` | replace-by-DBOS | same SQL as a DBOS scheduled workflow | [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) |
| A19 | Delta table, NOTIFY, SSE hub | `navier/runtime/stream.ts:62-104`, `navier/api/stream-hub.ts:41-100` | keep | owner decision 3 | — |
| A20 | Interceptors, trace header, OrgId attribute | `navier/temporal/trace.ts:18-74`, `navier/temporal/attributes.ts:1-16` | replace-by-DBOS | DBOS OTel + `workflowAttributes` | [P6.3](../phase-6/PHASE6_P6.3_OBSERVABILITY.md) |
| A21 | Replay tests | `navier/temporal/replay.ts:13-45` | replace-by-DBOS | recovery/kill/fork tests + patch rule | [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P7.1](../phase-7/PHASE7_P7.1_TEST_MATRIX.md) |
| A22 | Temporal probe, client, worker bootstrap | `navier/temporal/probe.ts:8-37`, `navier/temporal/worker.ts:50-92` | replace-by-DBOS | system-DB probe, `DBOS.launch`/`shutdown` | [P6.1](../phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) |

Count: keep 4, replace-by-DBOS 9, delete 6, simplify 3.

**Recovery cap (D3).** `maxRecoveries` is per agent version (`navier/agents/limits.ts:13-28`). DBOS `maxRecoveryAttempts` is per workflow registration (`dbos/dist/src/workflow.d.ts:45-57`). Pick: one global cap on the turn workflow (default 3, the current default); the audit sweep enforces a lower per-version value by reading the workflow's recovery count [U] and closing the message `gave_up`.

**Reaper → audit sweep (D4).** What remains of the reaper is one scheduled pass that finds `created`/`started`/`paused` messages whose workflow is terminal (`ERROR`, `CANCELLED`, `MAX_RECOVERY_ATTEMPTS_EXCEEDED`) or missing, and closes them `errored`. During the drain window it also enqueues missing DBOS workflows for rows written before the cutover flag ([P5.1](../phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md)).

**step_claim (D5).** A DBOS step that completed is never re-run; one interrupted mid-call is re-run and may call the model again — the same at-least-once the Temporal path accepts when an activity dies before claim. The guarded commit still rejects a second step row. So the claim table guards only concurrent duplicate executions, which DBOS prevents by workflow id.

**continue-as-new (D6).** Deleted with `MAX_HISTORY_LENGTH`; a DBOS workflow's step log has no replay-size limit [Doc].

**Failed-attempt deltas (D7).** Deltas streamed by a model attempt that later fails stay visible, as today (`navier/runtime/model-step.ts:480-505`); the client already renders the final committed step.

## Context and scope

The owner asked for the minimum, "especially all the things around the main agent workflow".

## Goals and non-goals

**Goals**

- **G1 —** Every piece has one verdict and one owner unit.
- **G2 —** Only product behaviour survives on the DBOS path.

**Non-goals**

- Changing the Temporal path (frozen).
- Changing tables (owner decision 5); deletions are of code paths, tables stay.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Rule | D1 | verdict vocabulary | owner goal |
| Table | A1–A22 | verdict + owner | [P0.2](PHASE0_P0.2_TEMPORAL_INVENTORY.md), [P0.3](PHASE0_P0.3_DBOS_FIT.md) |
| Recovery cap | D3 | global + sweep | [P3.1](../phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) |
| Audit sweep | D4 | one pass | [P3.3](../phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) |

## Decisions and rationale

### D1 — Minimum rule

Delete compensations for closed gaps; keep product behaviour; replace native features; simplify the rest. [pass 1]

### D2 — Verdict table

A1–A22 above: keep 4, replace 9, delete 6, simplify 3. [pass 3]

### D3 — Global recovery cap, per-version via sweep

Workflow `maxRecoveryAttempts` 3; per-version lower values enforced by the audit sweep [U]. [pass 2]

### D4 — Reaper shrinks to a turn audit sweep

Closes rows whose workflow is terminal or missing; enqueues missing ones only during the drain window. [pass 1]

### D5 — step_claim off the DBOS path

Checkpoint + guarded commit suffice; same at-least-once model call as today. [pass 1]

### D6 — continue-as-new deleted

No history limit; `maxSteps` bounds the loop. [pass 1]

### D7 — Failed-attempt deltas stay visible

Unchanged product behaviour; recorded so no one adds a cleanup. [pass 3]

## Unresolved questions and blockers

Open review findings at BINDING: R3-F1, R3-F2 — see [`reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md`](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md). The owner request (pt151u) authorizes BINDING after three rounds; these items keep their owners in the review Response tables.

## Relevant cross-cutting concerns

Tables stay (owner decision 5): `step_claim` and `recovery` stop receiving rows on the DBOS path; their drop is a later, separate owner decision ([P3.4](../phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md)).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D6 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-1) — VERDICT not-ready. | D1: port Temporal machinery 1:1 then simplify — two migrations; D3: per-version cap in a new table — keeps a reaper; D4: delete the reaper entirely — a terminal workflow with an open row would never close; D5: keep step_claim — guards a case DBOS ids prevent | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D3, D2 | Review fixes for R1-F1, R1-F2 ([round 1](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-1) |
| 3 | 2026-11-04 | BINDING | D2 | Review fixes for R2-F1, R2-F2 ([round 2](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-3) — VERDICT not-ready. | D7: delete failed-attempt deltas — new behaviour | [review round 2](reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md#round-2); new D7 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after round 3 not-ready — unresolved R3-F1, R3-F2 accepted as recorded in the review file |
