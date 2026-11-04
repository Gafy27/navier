# Phase 2 — DBOS turn workflow

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Run one Navier turn as one DBOS workflow on the same Postgres: steps with retries and timeouts, stop and interrupt that abort the in-flight call, approvals that wait in `recv` with the pause deadline, and a start that commits with the rows.

**Status:** designing (2026-11-04). All 5 units have BINDING architecture and program specs and a ticket anexo. Next: P2.1 first; P2.2, P2.3 and P2.4 in parallel; P2.5 last (start path, versioning, test replacement).

## Boundaries

- Only `src/runner/dbos/` imports `@dbos-inc/dbos-sdk` (profile layering).
- Step bodies are the `TurnSteps` of [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md); this phase adds `checkStop` and changes no step semantics except the attempt source ([P2.2](PHASE2_P2.2_STEPS_RETRIES.md) D4).
- No AI SDK: `ModelAdapter.generate` is called exactly as today (owner decision 2).
- Workflow inputs, outputs, step outputs, messages and events hold ids and enums only ([P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) L2).

| File | Role |
|------|------|
| `PHASE2_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE2_P2.1_TURN_WORKFLOW.md` | **BINDING through pass 2** (2026-11-04) P2.1 The DBOS turn workflow — D1–D7, laws L1–L3; `turnWorkflow(input)` registered as `navier.turn`; id `turn~org~thread~msg`; queue `turns` (partition `org~thread`, `partitionConcurrency` 1, `workerConcurrency` from config); body = load → pending actions → loop (checkStop → modelStep → tools) → pause/wait or finish; catch-all → `errored`; runKey = workflow id |
| `PHASE2_P2.1_TURN_WORKFLOW_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P2.1 landing — PD1–PD3; `src/runner/dbos/{workflow,queue,register,adapter}.ts` |
| `PHASE2_P2.1_TURN_WORKFLOW_TICKETS.md` | P2.1 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner/dbos`, 2 `src/runner/dbos`, 3 `src/runner/dbos`, 4 remove complexity + full test. Prereq: P1.5. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE2_P2.2_STEPS_RETRIES.md` | **BINDING through pass 3** (2026-11-04) P2.2 Steps, retries, timeouts and the attempt source — D1–D7; step configs mapped from `runtime/config.ts`; `shouldRetry` from the existing retryable table; abort signal = step timeout ∪ stop hub ∪ cancel; DB-derived attempt; deterministic parallel tool pool with `reserveStep`; failAction interrupted; ModelAdapter unchanged |
| `PHASE2_P2.2_STEPS_RETRIES_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P2.2 landing — PD1–PD3; `src/runner/dbos/{steps,pool,attempt}.ts` |
| `PHASE2_P2.2_STEPS_RETRIES_TICKETS.md` | P2.2 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner/dbos`, 2 `src/runner/dbos`, 3 `src/runner/dbos`, 4 remove complexity + full test. Prereq: P2.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE2_P2.3_STOP_INTERRUPT.md` | **BINDING through pass 3, unresolved R3-F1, R3-F2** (2026-11-04) P2.3 Stop, interrupt and graceful stop on DBOS — D1–D7, laws L1; stop row unchanged; `dbos.send_message(wf, {kind:"stop"}, "turn", "stop:"+kind)` and `NOTIFY navier_turn_stop` in the same tx; worker `StopHub` (one LISTEN connection) aborts registered steps; boundary `checkStop` step reads stop and pending rows; stop wins over decision and expiry |
| `PHASE2_P2.3_STOP_INTERRUPT_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P2.3 landing — PD1–PD3; `src/runner/dbos/{stop-hub,wake}.ts`; `checkStop` in `src/runtime/steps.ts` |
| `PHASE2_P2.3_STOP_INTERRUPT_TICKETS.md` | P2.3 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runtime`, 2 `src/runner/dbos`, 3 `src/runtime`, 4 remove complexity + full test. Prereq: P2.1, P2.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE2_P2.4_APPROVAL_PAUSE.md` | **BINDING through pass 2** (2026-11-04) P2.4 Approval and pause as a durable wait — D1–D6, laws L1; pause in place; `recv` with absolute deadline; decide tx adds `send_message(resume)` with key `resume:<pausedSeq>`; expiry closes `expired/pause_timeout` with CAS on `paused`; lost CAS → recv again; recovery re-enters the wait |
| `PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P2.4 landing — PD1–PD2; `src/runner/dbos/wait.ts`; decide edit; `pauseTurn` returns `{pausedSeq, expiresAtEpochMs}` |
| `PHASE2_P2.4_APPROVAL_PAUSE_TICKETS.md` | P2.4 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runner/dbos`, 2 `src/runtime`, 3 remove complexity + full test. Prereq: P2.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE2_P2.5_EXACTLY_ONCE.md` | **BINDING through pass 3, unresolved R3-F1, R3-F2** (2026-11-04) P2.5 Atomic start, exactly-once writes, versioning and the replay-test replacement — D1–D8; `SELECT dbos.enqueue_workflow(...)` inside post/edit/retry transactions; duplicate enqueue no-op; guarded appends unchanged; model call at-least-once accepted; pinned `applicationVersion` + `DBOS.patch`; tests: kill/recover, patch, fork; DBOS transactions not used (gate) |
| `PHASE2_P2.5_EXACTLY_ONCE_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P2.5 landing — PD1–PD3; `src/runner/dbos/start.ts`; edits in `runtime/{post,revise}.ts`; tests `test/dbos/{kill,patch,fork}.test.ts` |
| `PHASE2_P2.5_EXACTLY_ONCE_TICKETS.md` | P2.5 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner/dbos`, 2 `src/runner/dbos`, 3 `test/dbos`, 4 remove complexity + full test. Prereq: P2.1–P2.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE2_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE2_P2.1_TURN_WORKFLOW_REVIEW.md` | P2.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.1_TURN_WORKFLOW_PROGRAM_REVIEW.md` | P2.1 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.2_STEPS_RETRIES_REVIEW.md` | P2.2 architecture review, 3 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.2_STEPS_RETRIES_PROGRAM_REVIEW.md` | P2.2 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.3_STOP_INTERRUPT_REVIEW.md` | P2.3 architecture review, 3 round(s), final VERDICT not-ready; unresolved R3-F1, R3-F2 |
| `reviews/PHASE2_P2.3_STOP_INTERRUPT_PROGRAM_REVIEW.md` | P2.3 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.4_APPROVAL_PAUSE_REVIEW.md` | P2.4 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.4_APPROVAL_PAUSE_PROGRAM_REVIEW.md` | P2.4 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE2_P2.5_EXACTLY_ONCE_REVIEW.md` | P2.5 architecture review, 3 round(s), final VERDICT not-ready; unresolved R3-F1, R3-F2 |
| `reviews/PHASE2_P2.5_EXACTLY_ONCE_PROGRAM_REVIEW.md` | P2.5 program review, 2 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P2.1](PHASE2_P2.1_TURN_WORKFLOW.md) D2 — queue `turns` partitioned by thread with `partitionConcurrency: 1` (A) vs no queue, direct start (B).
- [P2.3](PHASE2_P2.3_STOP_INTERRUPT.md) D1 — stop = `stop_requested` row + `dbos.send_message` + `NOTIFY` to a worker abort hub, all in the API transaction (A) vs `DBOS.cancelWorkflow` (B) vs worker polling only (C).
- [P2.4](PHASE2_P2.4_APPROVAL_PAUSE.md) D1 — a paused turn keeps its workflow alive in `recv` until the decision or `expires_at` (A) vs end the workflow and start a new one with a suffixed id on decide (B).
- [P2.5](PHASE2_P2.5_EXACTLY_ONCE.md) D1 — start by `SELECT dbos.enqueue_workflow(...)` inside the post transaction (A) vs `DBOSClient.enqueueInTransaction` (B) vs enqueue after commit + audit sweep (C).
- [P2.5](PHASE2_P2.5_EXACTLY_ONCE.md) D7 — steps keep Navier's own `withTransaction` (A) vs DBOS `KyselyDataSource` transactions for finish/pause (B).
