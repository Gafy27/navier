# Phase 4 — authz-engine

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** Replace Navier's gRPC `cosmos.authz.v1` client and everything that depends on it with the owner's authz-engine behind one `NavierAuthz` seam: a Navier model, transaction-bound identity in DBOS steps, a shadow-checked cutover with rollback, then removal of the old client.

**Status:** designing (2026-11-04). All 5 units have BINDING architecture and program specs and a ticket anexo. Next: P4.1 and P4.2 together; P4.3 after [Phase 2](../phase-2/README.md) and P4.2; P4.4; P4.5 last, after the authz cutover.

## Boundaries

- The old client lives behind the seam only until the authz cutover ([P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md)); no new call site may use it.
- authz-engine is used through its public five-verb SDK only (`check`, `list`, `explain`, `write`, `tx`), never its tables (`aze/phases/phase-4/PHASE4_P4.1_SDK_API.md:56-78`).
- Approval state stays in Navier rows; authz-engine decides who may act ([P4.2](PHASE4_P4.2_NAVIER_MODEL.md) D4).
- authz-engine is a design today: every ticket here is blocked until its SDK and `provision()` ship [U].

| File | Role |
|------|------|
| `PHASE4_OVERVIEW.md` | Phase requirements note: condensed source docs, unit map, cross-unit interfaces. Not a binding spec |
| `PHASE4_P4.1_AUTHZ_SEAM.md` | **BINDING through pass 2** (2026-11-04) P4.1 Authz seam and call-site inventory — D1–D5, laws L1–L2; three ports (`checks`, `writes`, `reads`) covering all 23 `Authz` / `AuthzAdmin` methods; Navier `Decision` kept at the seam; optional `tx` on checks and writes; inventory of ~60 call sites in 30 files; `agent_principal` row retired |
| `PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P4.1 landing — PD1–PD3; `src/authz/{types,seam,legacy/adapter,engine/adapter,index}.ts`; call-site ports in four tickets |
| `PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md` | P4.1 tickets 1–5 — `1 -> 2 -> 3 -> 4 -> 5`; 1 `src/authz`, 2 `src/runtime`, 3 `src/agents`, 4 `src/api`, 5 remove complexity + full test. Prereq: P1.2. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE4_P4.2_NAVIER_MODEL.md` | **BINDING through pass 3** (2026-11-04) P4.2 Navier as an authz-engine model — D1–D7, laws L1; one `.fga` model with `@deny` markings and `@visible` agents; tuple mapping from every legacy write; agent principal `{type: agent, id, actingFor: user}`; tool-call check = agent ∩ user `invoke` + publisher `assign`; approvals stay rows; scenario file |
| `PHASE4_P4.2_NAVIER_MODEL_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P4.2 landing — PD1–PD2; `src/authz/engine/model/navier.fga`, `navier.scenarios.authz.yaml`, `src/authz/engine/mapping.ts` |
| `PHASE4_P4.2_NAVIER_MODEL_TICKETS.md` | P4.2 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/authz/engine`, 2 `src/authz/engine`, 3 remove complexity + full test. Prereq: authz-engine release, P4.1. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE4_P4.3_WORKFLOW_AUTHZ.md` | **BINDING through pass 2** (2026-11-04) P4.3 Identity propagation and checks inside DBOS steps — D1–D8, laws L1; workflow input stays ids-only; steps load the posting principal from rows; `authz.as(principal).tx(tx)` binds the principal as the first statement of the step's Navier transaction; tool check + running claim in one commit; decide checks in its tx; authz writes audited by the engine in Navier's tx; fail closed |
| `PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM.md` | **BINDING through pass 2** (2026-11-04) P4.3 landing — PD1–PD2; `src/authz/engine/adapter.ts` (tx-bound), principal loader in `src/runtime/steps.ts`, edits in tool-call/decide/post |
| `PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md` | P4.3 tickets 1–4 — `1 -> 2 -> 3 -> 4`; 1 `src/authz/engine`, 2 `src/runtime`, 3 `src/runtime`, 4 remove complexity + full test. Prereq: P4.2, P2.2, P2.4. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE4_P4.4_AUTHZ_CUTOVER.md` | **BINDING through pass 1** (2026-11-04) P4.4 Migration and cutover from the old authz service — D1–D7; `AUTHZ_MODE` legacy | shadow | engine | engine-shadow per org; export via `ListGrants`/markings to JSONL; import via service bulk import; dual-write with reconciliation; diff log ids-only; flip after 7 clean days; rollback = flag back + replay outbox |
| `PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM.md` | **BINDING through pass 3, unresolved R3-F1, R3-F2** (2026-11-04) P4.4 landing — PD1–PD3; `src/authz/shadow.ts`, `src/authz/outbox.ts`, `scripts/authz/{export,import,reconcile}.ts`; config `AUTHZ_MODE`, `AUTHZ_MODE_ORGS` |
| `PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md` | P4.4 tickets 1–5 — `1 -> 2 -> 3 -> 4 -> 5`; 1 `scripts/authz`, 2 `src/authz`, 3 `src/authz`, 4 `src/authz`, 5 remove complexity + full test. Prereq: P4.3. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `PHASE4_P4.5_GRPC_REMOVAL.md` | **BINDING through pass 2** (2026-11-04) P4.5 Removal of the old gRPC authz client — D1–D6; deletion list; what moves instead of deleting; what is kept (`service-token.ts`, principal, caller); dependency removal; config removal; outbox table dropped |
| `PHASE4_P4.5_GRPC_REMOVAL_PROGRAM.md` | **BINDING through pass 1** (2026-11-04) P4.5 landing — PD1–PD2; one deletion ticket + one config/deps ticket |
| `PHASE4_P4.5_GRPC_REMOVAL_TICKETS.md` | P4.5 tickets 1–3 — `1 -> 2 -> 3`; 1 `src/identity`, 2 `src`, 3 remove complexity + full test. Prereq: P4.4 + 14 days. Program BINDING — runnable once `commands.*` gates exist (all unavailable today) |
| `prompts/PHASE4_DESIGN_SESSIONS.md` | Paste-ready design-session blocks per unit and pass; produced the specs and anexos above |
| `reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md` | P4.1 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM_REVIEW.md` | P4.1 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md` | P4.2 architecture review, 3 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.2_NAVIER_MODEL_PROGRAM_REVIEW.md` | P4.2 program review, 1 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_REVIEW.md` | P4.3 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md` | P4.3 program review, 2 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.4_AUTHZ_CUTOVER_REVIEW.md` | P4.4 architecture review, 1 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md` | P4.4 program review, 3 round(s), final VERDICT not-ready; unresolved R3-F1, R3-F2 |
| `reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md` | P4.5 architecture review, 2 round(s), final VERDICT ready |
| `reviews/PHASE4_P4.5_GRPC_REMOVAL_PROGRAM_REVIEW.md` | P4.5 program review, 1 round(s), final VERDICT ready |

## Gates for owner

Gate picks in this phase were delegated to the designer (request pt151u); the owner has **not** answered them. These are the most consequential; reply with the id and A/B (or a named third) to overturn one.

- [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md) D1 — an intent-level `NavierAuthz` seam (checks, writes, reads named in Navier terms) with authz-engine as the default implementation (A) vs calling the authz-engine SDK directly at every call site (B).
- [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md) D5 — stop writing the `agent_principal` row; the agent principal is the authz-engine subject `agent:<org>~<id>` (A) vs keep the row as a second source (B).
- [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) D4 — approvals stay Navier rows (`action_decision`, `approval_memory`); authz-engine decides who may decide (A) vs approvals as expiring grants (B).
- [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md) D2 — authz-engine installed in Navier's Postgres (schema `authz`) and checked inside the step's own transaction (A) vs a separate authz database (B).
- [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) D2 — shadow mode: legacy decides, engine evaluated in parallel, flip per org after 7 days with zero diffs, reverse shadow for rollback (A) vs direct cutover (B).
