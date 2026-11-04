# Phase 7 — Hardening, open-source readiness and cleanup

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Replace the Temporal replay tests with a DBOS test matrix, close the security items deferred from phases 2–6, make Navier ready to publish (pluggable authz with authz-engine as default, license, quickstart, supported workflows), and delete what the migration made dead.

**Status:** designing (2026-11-04). All 4 units have BINDING architecture and program specs and a ticket anexo. Next: P7.1 and P7.2 together; P7.3; P7.4 last (after Temporal retirement sign-off).

## Boundaries

- Deletion of Temporal code waits for the retirement criterion ([P1.3](../phase-1/PHASE1_P1.3_TEMPORAL_FREEZE.md) D4) and owner sign-off ([P5.4](../phase-5/PHASE5_P5.4_RUNBOOK.md) step 11).
- Tables stay (owner decision 5); P7.4 only stops writes and proposes drops as an owner gate.
- The license is a proposal; the Navier license today is not stated in `src` [U].

| File | Role |
|------|------|
| `PHASE7_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE7_P7.1_TEST_MATRIX.md` | **BINDING through pass 2** (2026-11-04) P7.1 DBOS test matrix — D1–D3; T1 pure step bodies; T2 workflow tests on a real Postgres with DBOS launched in-process; T3 recovery tests (kill between steps, assert no duplicate effects); T4 shared harness S1–S12 against both runners until retirement; T5 load/chaos per release; version-patch test replaces replay |
| `PHASE7_P7.1_TEST_MATRIX_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P7.1 landing — PD1–PD2; `test/workflow/*.test.ts`, `test/recovery/*.test.ts`, `test/version/patch.test.ts`, lint rule `no-io-in-workflow` |
| `PHASE7_P7.1_TEST_MATRIX_TICKETS.md` | P7.1 tickets 1–3 — `1 -> 2 -> 3`; 1 `test`, 2 `test`, 3 remove complexity + full test. Prereq: P1.5, P2.5. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE7_P7.2_SECURITY_REVIEW.md` | **BINDING through pass 2** (2026-11-04) P7.2 Security review — D1–D5; three roles (migration, app, read-only ops); app EXECUTE on enqueue/send functions + DML on dbos tables needed by the executor [U exact list]; L2 enforced by a payload schema check; Conductor not used, or metadata-only; dbos.workflow_status retention 30 days; authz service role only in migration |
| `PHASE7_P7.2_SECURITY_REVIEW_PROGRAM.md` | **BINDING through pass 3** (2026-11-04) P7.2 landing — PD1–PD3; `scripts/db/roles.sql.ts` (generated grants), payload assert in `src/runner/dbos/register.ts`, retention workflow |
| `PHASE7_P7.2_SECURITY_REVIEW_TICKETS.md` | P7.2 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `scripts/db`, 2 `src/runner/dbos`, 3 `src/runner/dbos`, 4 remove complexity + full test. Prereq: P2.5, P3.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE7_P7.3_OSS_READINESS.md` | **BINDING through pass 3** (2026-11-04) P7.3 Open-source readiness — D1–D5; `NavierAuthz` is the public plug point with authz-engine as default adapter and a conformance suite; Apache-2.0; 6-step quickstart on one Postgres; supported workflows list with explicit non-goals; docs set |
| `PHASE7_P7.3_OSS_READINESS_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P7.3 landing — PD1–PD3; `docs/` set, `packages/authz-conformance/`, `navier seed` CLI command, quickstart CI job |
| `PHASE7_P7.3_OSS_READINESS_TICKETS.md` | P7.3 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `packages/authz-conformance`, 2 `src/cli`, 3 `docs`, 4 remove complexity + full test. Prereq: P4.5, P7.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE7_P7.4_DEAD_CODE.md` | **BINDING through pass 2** (2026-11-04) P7.4 Temporal retirement and dead-code removal — D1–D4; after sign-off delete `temporal/`, `workflows.ts`, `activities.ts`, `runtime/activities.ts`, reaper restart paths, `@temporalio/*` deps, TEMPORAL_* config; step_claim/recovery read-only; audit sweep kept as a sweep (not a reaper) with an expiry review after 90 days of zero closes |
| `PHASE7_P7.4_DEAD_CODE_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P7.4 landing — PD1–PD2; one deletion PR; a `scripts/check/no-temporal.ts` CI guard |
| `PHASE7_P7.4_DEAD_CODE_TICKETS.md` | P7.4 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src`, 2 `scripts/check`, 3 `src/runtime`, 4 remove complexity + full test. Prereq: P5.4 sign-off, P7.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE7_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE7_P7.1_TEST_MATRIX_REVIEW.md` | P7.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.1_TEST_MATRIX_PROGRAM_REVIEW.md` | P7.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.2_SECURITY_REVIEW_REVIEW.md` | P7.2 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.2_SECURITY_REVIEW_PROGRAM_REVIEW.md` | P7.2 program review, 3 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.3_OSS_READINESS_REVIEW.md` | P7.3 architecture review, 3 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.3_OSS_READINESS_PROGRAM_REVIEW.md` | P7.3 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.4_DEAD_CODE_REVIEW.md` | P7.4 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE7_P7.4_DEAD_CODE_PROGRAM_REVIEW.md` | P7.4 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P7.3](PHASE7_P7.3_OSS_READINESS.md) D2 — license: Apache-2.0 for Navier, matching authz-engine and compatible with the MIT DBOS SDK (A) vs MIT (B).
- [P7.3](PHASE7_P7.3_OSS_READINESS.md) D1 — authz is pluggable through `NavierAuthz` with authz-engine as the default and only bundled adapter; other adapters must pass the conformance suite (A) vs bundle a second adapter (B).
- [P7.4](PHASE7_P7.4_DEAD_CODE.md) D3 — after retirement, stop writing `step_claim` and `recovery` and keep the tables read-only until the owner approves a drop (A) vs drop them in the retirement release (B).
- [P7.2](PHASE7_P7.2_SECURITY_REVIEW.md) D1 — application role gets only EXECUTE on `dbos.enqueue_workflow` and `dbos.send_message` plus SELECT on `dbos.workflow_status`; DDL only for the migration role (A) vs application role owns the `dbos` schema (B).
