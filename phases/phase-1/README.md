# Phase 1 — Runner seam

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Put one small `TurnRunner` interface between Navier's domain code and the runner, move every Temporal-specific file behind it unchanged and frozen, and prove both runners with one shared conformance harness.

**Status:** designing (2026-11-04). All 5 units have BINDING architecture and program specs and a ticket anexo. Next: P1.1 first; P1.2 and P1.3 together (the move and the port are one refactor); P1.4; P1.5 last.

## Boundaries

- `src/runtime/` imports no runner SDK after this phase ([P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) L1).
- The Temporal adapter changes only by moving files and injecting the step guard; behaviour is identical ([P1.3](PHASE1_P1.3_TEMPORAL_FREEZE.md)).
- No DBOS code lands here except the interface the DBOS runner will implement ([Phase 2](../phase-2/README.md)).

| File | Role |
|------|------|
| `PHASE1_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE1_P1.1_RUNNER_INTERFACE.md` | **BINDING through pass 2** (2026-11-04) P1.1 Runner interface and runner-neutral steps — D1–D4, laws L1–L2; `TurnRunner` {start, wakeStop, wakeDecision, awaitEnd, probe, close}; `TurnSteps` = the existing activity bodies as plain functions; ownership by workflow-id lookup; domain imports no runner SDK |
| `PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P1.1 landing — PD1–PD2; `src/runner/types.ts`, `src/runtime/steps.ts`, `src/runner/owner.ts` |
| `PHASE1_P1.1_RUNNER_INTERFACE_TICKETS.md` | P1.1 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner`, 2 `src/runtime`, 3 `src/runner`, 4 remove complexity + full test. Prereq: P0.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE1_P1.2_OPERATIONS_PORT.md` | **BINDING through pass 1** (2026-11-04) P1.2 Port every runner call site to the interface — D1–D3; thirteen call sites mapped to six operations; deps objects carry `runners` instead of `temporal`; `runnerFor(tx, ref)` picks the owner for wake/await and the configured runner for start |
| `PHASE1_P1.2_OPERATIONS_PORT_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P1.2 landing — PD1–PD2; `src/runner/runners.ts`; edits in `runtime/{start,stop,decide,revise,activities}.ts`, `sdk/{turn,runtime}.ts`, `worker.ts`, `api.ts`, `api/routes/chat/handler.ts` |
| `PHASE1_P1.2_OPERATIONS_PORT_TICKETS.md` | P1.2 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runtime`, 2 `src/runtime`, 3 `src`, 4 remove complexity + full test. Prereq: P1.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE1_P1.3_TEMPORAL_FREEZE.md` | **BINDING through pass 2** (2026-11-04) P1.3 Temporal as a frozen adapter — D1–D5, laws L1; move list; frozen definition; `StepGuard` injection so `step_claim` is Temporal-only; retirement criterion; no feature work |
| `PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM.md` | **BINDING through pass 3** (2026-11-04) P1.3 landing — PD1–PD3; `git mv` list; `src/runner/temporal/adapter.ts` implementing `TurnRunner`; `StepGuard` type in `src/runtime/model-step.ts` |
| `PHASE1_P1.3_TEMPORAL_FREEZE_TICKETS.md` | P1.3 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/runner/temporal`, 2 `src/runner/temporal`, 3 `src/runtime`, 4 remove complexity + full test. Prereq: P1.1, P1.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE1_P1.4_RUNNER_CONFIG.md` | **BINDING through pass 1** (2026-11-04) P1.4 Runner configuration and selection — D1–D4; zod config: `RUNNER_DEFAULT` dbos|temporal, `RUNNER_TEMPORAL_ORGS` (drain-period override), DBOS block (system DB = `DATABASE_URL`, schema `dbos`, `DBOS_APP_VERSION`, `DBOS_EXECUTOR_ID`), Temporal block optional |
| `PHASE1_P1.4_RUNNER_CONFIG_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P1.4 landing — PD1; `src/runner/config.ts` with `RunnerConfigSchema`; edits in `src/config.ts` |
| `PHASE1_P1.4_RUNNER_CONFIG_TICKETS.md` | P1.4 tickets 1–2 — `1 -> 2`; 1 `src/runner`, 2 remove complexity + full test. Prereq: P1.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE1_P1.5_SHARED_HARNESS.md` | **BINDING through pass 2** (2026-11-04) P1.5 Shared runner conformance harness — D1–D5; scripted `ModelAdapter` and tool fakes; twelve scenarios; row assertions only; Temporal leg on a dev server; DBOS leg on disposable Postgres; kill scenarios DBOS-only |
| `PHASE1_P1.5_SHARED_HARNESS_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P1.5 landing — PD1–PD2; `test/conformance/{harness,fakes,scenarios}.ts`; `node --test` entry per runner |
| `PHASE1_P1.5_SHARED_HARNESS_TICKETS.md` | P1.5 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `test/conformance`, 2 `test/conformance`, 3 `test/conformance`, 4 remove complexity + full test. Prereq: P1.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE1_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE1_P1.1_RUNNER_INTERFACE_REVIEW.md` | P1.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.1_RUNNER_INTERFACE_PROGRAM_REVIEW.md` | P1.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.2_OPERATIONS_PORT_REVIEW.md` | P1.2 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.2_OPERATIONS_PORT_PROGRAM_REVIEW.md` | P1.2 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.3_TEMPORAL_FREEZE_REVIEW.md` | P1.3 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.3_TEMPORAL_FREEZE_PROGRAM_REVIEW.md` | P1.3 program review, 3 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.4_RUNNER_CONFIG_REVIEW.md` | P1.4 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.4_RUNNER_CONFIG_PROGRAM_REVIEW.md` | P1.4 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.5_SHARED_HARNESS_REVIEW.md` | P1.5 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE1_P1.5_SHARED_HARNESS_PROGRAM_REVIEW.md` | P1.5 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P1.1](PHASE1_P1.1_RUNNER_INTERFACE.md) D4 — a turn belongs to DBOS iff `dbos.workflow_status` has its workflow id; no new column (A) vs a `runner` column on the agent message (B).
- [P1.3](PHASE1_P1.3_TEMPORAL_FREEZE.md) D4 — retire Temporal when no non-terminal Temporal turn exists for 14 days and the owner signs off (A) vs keep the adapter indefinitely as a supported fallback (B).
- [P1.5](PHASE1_P1.5_SHARED_HARNESS.md) D1 — one conformance suite asserting only rows, run on both runners (A) vs separate per-runner suites (B).
