# Phase 3 — Simplification

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Delete or shrink, on the DBOS path, every piece of machinery the audit marked delete / replace / simplify: claims, the recovery table and reaper restarts, the pending-promotion start, Temporal schedules, the stream sweep, and the config and migrations that only served them — without touching tables.

**Status:** designing (2026-11-04). All 4 units have BINDING architecture and program specs and a ticket anexo. Next: P3.1 and P3.2 in parallel; P3.3 after P3.1; P3.4 last.

## Boundaries

- Verdicts come from [P0.4](../phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md); this phase implements them and may not change one (P0.4 PD2).
- The frozen Temporal adapter keeps every deleted piece until it retires ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4).
- No table is dropped or altered (owner decision 5); tables that stop receiving rows are listed for a later owner decision.

| File | Role |
|------|------|
| `PHASE3_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE3_P3.1_CLAIMS_RECOVERY.md` | **BINDING through pass 2** (2026-11-04) P3.1 Claims and recovery off the DBOS path — D1–D5; DBOS path passes no `StepGuard`; executor recovery restarts dead turns; `maxRecoveryAttempts` 3 on `navier.turn`; per-version lower `maxRecoveries` enforced by the sweep from `recoveryAttempts`; `START_GRACE_MS` Temporal-only |
| `PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P3.1 landing — PD1–PD2; registration option in `src/runner/dbos/workflow.ts`; cap log in `agents/publish.ts`; config key marked Temporal-only |
| `PHASE3_P3.1_CLAIMS_RECOVERY_TICKETS.md` | P3.1 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runner/dbos`, 2 `src`, 3 remove complexity + full test. Prereq: P2.2, P1.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE3_P3.2_PENDING_PROMOTION.md` | **BINDING through pass 1** (2026-11-04) P3.2 Pending messages and promotion without a lost start — D1–D3, laws L1; pending machinery kept (product behaviour); pending arm signal deleted (rows read by `checkStop`); `closeTurn` enqueues the minted promoted message by SQL in its own transaction; `startPromoted` and the reaper fallback unused on DBOS |
| `PHASE3_P3.2_PENDING_PROMOTION_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P3.2 landing — PD1; `closeTurn` gets `runners` and calls `start(tx, ref)` for the minted id; `startTurn` pending arm becomes owner-dependent |
| `PHASE3_P3.2_PENDING_PROMOTION_TICKETS.md` | P3.2 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runtime`, 2 `src/runtime`, 3 remove complexity + full test. Prereq: P2.5. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE3_P3.3_SCHEDULES_SWEEPS.md` | **BINDING through pass 3** (2026-11-04) P3.3 Schedules: the turn audit sweep and the stream sweep — D1–D4; `navier.auditSweep` every minute: open messages whose DBOS workflow is ERROR / CANCELLED / MAX_RECOVERY_ATTEMPTS_EXCEEDED / missing → close `errored`; PENDING over per-version recovery limit → cancel + close; drain-window enqueue of missing ones; `navier.streamSweep` = same SQL; both on `applySchedules` |
| `PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P3.3 landing — PD1–PD2; `src/runner/dbos/{audit-sweep,stream-sweep,schedules}.ts` |
| `PHASE3_P3.3_SCHEDULES_SWEEPS_TICKETS.md` | P3.3 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runner/dbos`, 2 `src/runner/dbos`, 3 remove complexity + full test. Prereq: P3.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE3_P3.4_SCHEMA_MIGRATIONS.md` | **BINDING through pass 1** (2026-11-04) P3.4 Schema and config inventory after simplification — D1–D4; 23 runtime migrations classified; `step_claim`, `recovery` Temporal-only; DBOS system schema managed by `DBOS.migrate` at deploy; config keys classified; no Navier migration added |
| `PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P3.4 landing — PD1; `docs/runner/schema.md`; deploy script step `dbos migrate` |
| `PHASE3_P3.4_SCHEMA_MIGRATIONS_TICKETS.md` | P3.4 tickets 1–2 — `1 -> 2`; 1 `scripts`, 2 remove complexity + full test. Prereq: P3.1–P3.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE3_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE3_P3.1_CLAIMS_RECOVERY_REVIEW.md` | P3.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.1_CLAIMS_RECOVERY_PROGRAM_REVIEW.md` | P3.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.2_PENDING_PROMOTION_REVIEW.md` | P3.2 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.2_PENDING_PROMOTION_PROGRAM_REVIEW.md` | P3.2 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_REVIEW.md` | P3.3 architecture review, 3 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.3_SCHEDULES_SWEEPS_PROGRAM_REVIEW.md` | P3.3 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_REVIEW.md` | P3.4 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE3_P3.4_SCHEMA_MIGRATIONS_PROGRAM_REVIEW.md` | P3.4 program review, 2 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P3.1](PHASE3_P3.1_CLAIMS_RECOVERY.md) D2 — global `maxRecoveryAttempts` 3 on the workflow, per-version lower limits enforced by the audit sweep from `recoveryAttempts` (A) vs per-version caps through one registration per limit value (B).
- [P3.2](PHASE3_P3.2_PENDING_PROMOTION.md) D1 — enqueue the promoted turn inside `closeTurn`'s transaction by SQL (A) vs enqueue from workflow code after the finish step (B).
- [P3.3](PHASE3_P3.3_SCHEDULES_SWEEPS.md) D1 — one scheduled turn audit sweep (every minute) replaces the reaper on the DBOS path (A) vs no sweep at all (B).
- [P3.4](PHASE3_P3.4_SCHEMA_MIGRATIONS.md) D2 — leave `step_claim` and `recovery` tables in place, unused by DBOS, until Temporal retires (A) vs drop them at cutover (B).
