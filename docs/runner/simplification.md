# Simplification checklist: one verdict per piece around the turn workflow

Specs: [P0.4](../../phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) (D1–D7, BINDING), [program](../../phases/phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md) (PD1, PD2).
Sources: [current-state.md](current-state.md), [temporal-inventory.md](temporal-inventory.md), [dbos-fit.md](dbos-fit.md).

## How to use (PD1)

This table is the cleanup checklist. [P7.4](../../phases/phase-7/PHASE7_P7.4_DEAD_CODE.md) ticks a row when its owner ticket has landed and the code path is gone or frozen. A verdict changes only by an amending pass of the P0.4 spec (PD2); no ticket edits it here.

Rule (D1): a piece that only covers a Temporal gap DBOS closes is deleted on the DBOS path; product behaviour is kept; what DBOS does natively is replaced; the rest is simplified. The frozen Temporal adapter ([P1.3](../../phases/phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md)) keeps every piece until it is retired. Tables stay (owner decision 5); `step_claim` and `recovery` only stop receiving rows ([P3.4](../../phases/phase-3/PHASE3_P3.4_SCHEMA_MIGRATIONS.md) decides their drop).

## Verdicts (D2)

| # | Piece | Where | Verdict | Why | Owner | Done |
|---|-------|-------|---------|-----|-------|------|
| A1 | Temporal workflow + activities | `navier/runtime/workflow.ts:25-37`, `navier/runtime/activities.ts:186-257` | replace-by-DBOS | DBOS workflow + steps | [P2.1](../../phases/phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) | [ ] |
| A2 | Signals cancel/interrupt | `navier/runtime/workflow.ts:20-22` | replace-by-DBOS | stop row + `send_message` in the same tx + in-step abort hub | [P2.3](../../phases/phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) | [ ] |
| A3 | Signal graceful_stop | `navier/runtime/stop.ts:38-56` | delete | boundary step reads the stop row and open pending rows | [P2.3](../../phases/phase-2/PHASE2_P2.3_STOP_INTERRUPT.md) | [ ] |
| A4 | Cancellation scopes / nonCancellable | `navier/runtime/turn-loop.ts:192-228` | simplify | workflow catches all and always runs the finish step | [P2.1](../../phases/phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) | [ ] |
| A5 | continue-as-new + `MAX_HISTORY_LENGTH` | `navier/runtime/turn-loop.ts:79-87` | delete | no history limit; `maxSteps` bounds steps | [P2.1](../../phases/phase-2/PHASE2_P2.1_TURN_WORKFLOW.md) | [ ] |
| A6 | Start after commit + reaper lost-start | `navier/runtime/start.ts:83-112` | delete | enqueue inside the same transaction | [P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) | [ ] |
| A7 | Reaper restart of dead turns | `navier/runtime/reaper.ts:272-306` | replace-by-DBOS | executor recovery | [P3.1](../../phases/phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) | [ ] |
| A8 | `recovery` table + `maxRecoveries` | `navier/runtime/reaper.ts:194-226` | replace-by-DBOS | `maxRecoveryAttempts` (D3) | [P3.1](../../phases/phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) | [ ] |
| A9 | Reaper pause-expiry pass | `navier/runtime/reaper.ts:388-512` | delete | `recv` deadline in the live workflow | [P2.4](../../phases/phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) | [ ] |
| A10 | Reaper as a whole | `navier/runtime/reaper.ts:336-357` | simplify | one small scheduled **turn audit sweep** closes rows whose workflow is terminal (D4) | [P3.3](../../phases/phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) | [ ] |
| A11 | `START_GRACE_MS` | `navier/config.ts:11-18` | delete | no start race when start is transactional | [P3.1](../../phases/phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) | [ ] |
| A12 | `step_claim` | `navier/runtime/model-step.ts:210-249` | delete (DBOS path) | step checkpoint + guarded commit (D5) | [P3.1](../../phases/phase-3/PHASE3_P3.1_CLAIMS_RECOVERY.md) | [ ] |
| A13 | Guarded commit / `appendIfNewest` | `navier/db/append.ts:42-75` | keep | the exactly-once write rule | [P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) | [ ] |
| A14 | decide restart | `navier/runtime/decide.ts:514-533` | delete | decision is a `send_message` | [P2.4](../../phases/phase-2/PHASE2_P2.4_APPROVAL_PAUSE.md) | [ ] |
| A15 | Pending queue + promotion | `navier/runtime/close.ts:150-202`, `navier/runtime/pending.ts:77-140` | keep | product behaviour (queued user messages) | [P3.2](../../phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) | [ ] |
| A16 | Promoted start in finishTurn | `navier/runtime/activities.ts:163-179` | simplify | workflow enqueues the promoted turn after its finish step | [P3.2](../../phases/phase-3/PHASE3_P3.2_PENDING_PROMOTION.md) | [ ] |
| A17 | Conversation advisory lock, step plan | `navier/runtime/lock.ts:9-17`, `navier/runtime/step-plan.ts:1-24` | keep | serialises posts and plans; runner-neutral | — | [ ] |
| A18 | Stream sweep | `navier/runtime/stream-sweep.ts:25-45` | replace-by-DBOS | same SQL as a DBOS scheduled workflow | [P3.3](../../phases/phase-3/PHASE3_P3.3_SCHEDULES_SWEEPS.md) | [ ] |
| A19 | Delta table, NOTIFY, SSE hub | `navier/runtime/stream.ts:62-104`, `navier/api/stream-hub.ts:41-100` | keep | owner decision 3 | — | [ ] |
| A20 | Interceptors, trace header, OrgId attribute | `navier/temporal/trace.ts:18-74`, `navier/temporal/attributes.ts:1-16` | replace-by-DBOS | DBOS OTel + `workflowAttributes` | [P6.3](../../phases/phase-6/PHASE6_P6.3_OBSERVABILITY.md) | [ ] |
| A21 | Replay tests | `navier/temporal/replay.ts:13-45` | replace-by-DBOS | recovery/kill/fork tests + patch rule | [P2.5](../../phases/phase-2/PHASE2_P2.5_EXACTLY_ONCE.md), [P7.1](../../phases/phase-7/PHASE7_P7.1_TEST_MATRIX.md) | [ ] |
| A22 | Temporal probe, client, worker bootstrap | `navier/temporal/probe.ts:8-37`, `navier/temporal/worker.ts:50-92` | replace-by-DBOS | system-DB probe, `DBOS.launch`/`shutdown` | [P6.1](../../phases/phase-6/PHASE6_P6.1_WORKER_DEPLOYMENT.md) | [ ] |

Count: keep 4, replace-by-DBOS 9, delete 6, simplify 3.

## Decisions the rows rely on

- **D3 recovery cap:** one global `maxRecoveryAttempts` 3 on the turn workflow; the audit sweep enforces a lower per-agent-version value and closes the message `gave_up` [U] (A8).
- **D4 audit sweep:** the reaper shrinks to one scheduled pass that closes `created`/`started`/`paused` rows whose workflow is terminal or missing as `errored`; during the drain window it also enqueues missing workflows ([P5.1](../../phases/phase-5/PHASE5_P5.1_DRAIN_DUALRUN.md)) (A10).
- **D5 step_claim:** a completed DBOS step is never re-run; the guarded commit rejects a second step row (A12, A13).
- **D6 continue-as-new:** deleted; `maxSteps` bounds the loop (A5).
- **D7 failed-attempt deltas:** stay visible, unchanged; add no cleanup (A19).
