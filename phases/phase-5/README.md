# Phase 5 — Migration and cutover

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Move new turns to DBOS org by org while in-flight Temporal turns drain on Temporal, with tables unchanged, a one-flag rollback for new turns, and a runbook that also sequences the authz cutover.

**Status:** designing (2026-11-04). All 4 units have BINDING architecture and program specs and a ticket anexo. Next: P5.1 and P5.2 together; P5.3; P5.4 last.

## Boundaries

- No data migration of turns: a turn finishes on the runner that started it ([P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) D4).
- Tables unchanged (owner decision 5); the only temporary table of the project is the authz outbox ([P4.4](../phase-4/PHASE4_P4.4_AUTHZ_CUTOVER.md)).
- Temporal stays frozen during the drain ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md)).

| File | Role |
|------|------|
| `PHASE5_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE5_P5.1_DRAIN_DUALRUN.md` | **BINDING through pass 2** (2026-11-04) P5.1 Drain and dual-run — D1–D5; worker runs DBOS + Temporal worker + Temporal reaper during the drain; API routes wakes by owner; no turn moves; drain end = zero non-terminal Temporal-owned messages, measured by one query |
| `PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P5.1 landing — PD1–PD2; reaper filter in `src/runner/temporal/reaper.ts`; drain metric query in `src/runner/drain.ts` |
| `PHASE5_P5.1_DRAIN_DUALRUN_TICKETS.md` | P5.1 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/runner/temporal`, 2 `src/runner`, 3 remove complexity + full test. Prereq: P1.3, P3.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE5_P5.2_ROLLOUT_FLAGS.md` | **BINDING through pass 1** (2026-11-04) P5.2 Rollout flags and order — D1–D3; two-stage flags; order: test org → internal orgs → 10 % of orgs → all; gates per stage (harness green, zero dead-lettered turns, p95 start latency within 20 % of Temporal); authz modes independent per org |
| `PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P5.2 landing — PD1; `RUNNER_DBOS_ORGS` added to `RunnerConfigSchema`; `forStart` precedence |
| `PHASE5_P5.2_ROLLOUT_FLAGS_TICKETS.md` | P5.2 tickets 1–2 — `1 -> 2`; 1 `src/runner`, 2 remove complexity + full test. Prereq: P1.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE5_P5.3_ROLLBACK_COMPAT.md` | **BINDING through pass 2** (2026-11-04) P5.3 Rollback and compatibility — D1–D4; rollback = org back to Temporal for new turns; DBOS workers keep running until DBOS-owned turns end; no schema change to undo; API and SDK unchanged in both directions; Temporal-only tables still written by Temporal turns |
| `PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P5.3 landing — PD1; deploy guard script checking the DBOS drain count |
| `PHASE5_P5.3_ROLLBACK_COMPAT_TICKETS.md` | P5.3 tickets 1–2 — `1 -> 2`; 1 `scripts`, 2 remove complexity + full test. Prereq: P5.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE5_P5.4_RUNBOOK.md` | **BINDING through pass 1** (2026-11-04) P5.4 Cutover runbook (runner and authz) — D1–D3; 12 steps: provision → migrate → deploy dual-run → test org → stages → default flip → drain → authz export/import → authz shadow → authz flips → Temporal retirement → gRPC removal |
| `PHASE5_P5.4_RUNBOOK_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P5.4 landing — PD1; `docs/runner/cutover-runbook.md` in the Navier repo |
| `PHASE5_P5.4_RUNBOOK_TICKETS.md` | P5.4 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: P5.1–P5.3, P6.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE5_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE5_P5.1_DRAIN_DUALRUN_REVIEW.md` | P5.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.1_DRAIN_DUALRUN_PROGRAM_REVIEW.md` | P5.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.2_ROLLOUT_FLAGS_REVIEW.md` | P5.2 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.2_ROLLOUT_FLAGS_PROGRAM_REVIEW.md` | P5.2 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.3_ROLLBACK_COMPAT_REVIEW.md` | P5.3 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.3_ROLLBACK_COMPAT_PROGRAM_REVIEW.md` | P5.3 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.4_RUNBOOK_REVIEW.md` | P5.4 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE5_P5.4_RUNBOOK_PROGRAM_REVIEW.md` | P5.4 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P5.1](PHASE5_P5.1_DRAIN_DUALRUN.md) D2 — drain only: Temporal turns (including paused ones) finish on Temporal; nothing is moved (A) vs re-enqueue paused Temporal turns on DBOS (B).
- [P5.2](PHASE5_P5.2_ROLLOUT_FLAGS.md) D1 — per-org rollout with `RUNNER_TEMPORAL_ORGS` as the list of orgs still on Temporal, internal orgs first (A) vs global switch (B).
- [P5.3](PHASE5_P5.3_ROLLBACK_COMPAT.md) D2 — rollback flips new turns back to Temporal; DBOS-started turns finish on DBOS (A) vs stop DBOS workers on rollback (B).
