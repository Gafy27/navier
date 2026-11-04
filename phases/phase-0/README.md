# Phase 0 — Research and map

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Map how one Navier turn runs today, what Temporal provides, what each piece of surrounding machinery is for, how DBOS covers each need, and give every piece a keep / replace-by-DBOS / delete / simplify verdict.

**Status:** designing (2026-11-04). All 4 units have BINDING architecture and program specs and a ticket anexo. Next: P0.1 and P0.2 first; P0.3 after P0.2; P0.4 last (it consumes all three).

## Boundaries

- Research only: units describe the zip at its pin and cite `navier/path:a-b`; no unit prescribes code (that starts in [Phase 1](../phase-1/README.md)).
- DBOS facts are `[S]` only when cited in the installed SDK (tree `dbos`), `[Doc]` when read on docs.dbos.dev 2026-11-04, else `[U]`.
- Owner decisions in `factory/profile/navier_dbos/requirements.md` are inputs, not findings to reopen.

| File | Role |
|------|------|
| `PHASE0_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE0_P0.1_CURRENT_STATE_MAP.md` | **BINDING through pass 1** (2026-11-04) P0.1 Current-state map of one agent turn — D1–D5, laws L1; a lifecycle map with ten stages, each with owner file, line range, state written, and runner coupling; the "rows are the truth" finding; the `llm/` AI SDK note; identity/authz touchpoints routed to [Phase 4](../phase-4/README.md) |
| `PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P0.1 landing — PD1–PD2; `docs/runner/current-state.md` in the Navier repo, generated from this spec |
| `PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md` | P0.1 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: none. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE0_P0.2_TEMPORAL_INVENTORY.md` | **BINDING through pass 2** (2026-11-04) P0.2 Temporal inventory and what the machinery around it is for — D1–D4; a 13-row feature inventory, an 8-row "why it exists" table for the surrounding machinery, and the Temporal-only guarantees Navier does not rely on |
| `PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P0.2 landing — PD1; `docs/runner/temporal-inventory.md` in the Navier repo |
| `PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md` | P0.2 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: P0.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE0_P0.3_DBOS_FIT.md` | **BINDING through pass 3** (2026-11-04) P0.3 DBOS fit: each need mapped to a DBOS 5.4.0 API — D1–D6; mapping table for T1–T13 and M1–M8; same-database system schema; recovery semantics without Conductor; three gaps (in-step abort, attempt reset, id reuse); `[U]` list |
| `PHASE0_P0.3_DBOS_FIT_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P0.3 landing — PD1–PD2; `docs/runner/dbos-fit.md` in the Navier repo; the `[U]` list feeds [P2.5](../phase-2/PHASE2_P2.5_EXACTLY_ONCE.md) and [P6.5](../phase-6/PHASE6_P6.5_LOAD_CHAOS.md) tests |
| `PHASE0_P0.3_DBOS_FIT_TICKETS.md` | P0.3 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: P0.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE0_P0.4_SIMPLIFICATION_AUDIT.md` | **BINDING through pass 3, unresolved R3-F1, R3-F2** (2026-11-04) P0.4 Simplification audit of the machinery around the turn workflow — D1–D7; the minimum rule (D1); a 22-row verdict table (D2); recovery cap policy (D3); reaper → audit sweep (D4); step_claim off the DBOS path (D5); continue-as-new deleted (D6); failed-attempt deltas (D7) |
| `PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P0.4 landing — PD1–PD2; the verdict table lands as `docs/runner/simplification.md`; each row owns a ticket in its owner unit |
| `PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md` | P0.4 tickets 1–2 — `1 -> 2`; 1 `docs`, 2 remove complexity + full test. Prereq: P0.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE0_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE0_P0.1_CURRENT_STATE_MAP_REVIEW.md` | P0.1 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM_REVIEW.md` | P0.1 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_REVIEW.md` | P0.2 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM_REVIEW.md` | P0.2 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.3_DBOS_FIT_REVIEW.md` | P0.3 architecture review, 3 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.3_DBOS_FIT_PROGRAM_REVIEW.md` | P0.3 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_REVIEW.md` | P0.4 architecture review, 3 round(s), final VERDICT not-ready; unresolved R3-F1, R3-F2 |
| `reviews/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM_REVIEW.md` | P0.4 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D1 — minimum rule: delete every piece whose only job is to cover a Temporal gap DBOS closes, keep product behaviour (A) vs port the Temporal machinery 1:1 onto DBOS first and simplify later (B).
- [P0.4](PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D3 — per-agent-version `maxRecoveries` becomes one global `maxRecoveryAttempts` on the turn workflow, enforced per version only by the audit sweep (A) vs keep per-version restarts in an app-level table (B).
- [P0.3](PHASE0_P0.3_DBOS_FIT.md) D2 — DBOS system schema lives in the same Postgres database as Navier (schema `dbos`) so starts and messages commit with Navier rows (A) vs a separate system database (B).
