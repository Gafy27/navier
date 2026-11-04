# Phases — plan, status, decision log

This is the plan file (`paths.plan` in `factory/config.yaml`). It lists every phase, the status of every unit, the cross-phase documents, and the decisions the owner still has to make. Designs are written; **this repository holds no product code** — tickets apply to the Navier repository. Every unit is BINDING by owner request (pt151u, 2026-11-04), 1 of them with review findings still open.

## Phases

| Phase | Name | Objective | Units |
|-------|------|-----------|-------|
| [phase-0](phase-0/README.md) | Research and map | Map how one Navier turn runs today, what Temporal provides, what each piece of surrounding machinery is for, how DBOS covers each need, and give every piece a keep / replace-by-DBOS / delete / simplify verdict. | P0.1, P0.2, P0.3, P0.4 |

## Where the owner goals live

| Goal (root README) | Dedicated units |
|--------------------|-----------------|
| DBOS on the same Postgres as the runner | P0.3, phase-2 (P2.1–P2.5) |
| Temporal kept as a frozen second runner | P1.1, P1.3, P1.4, P5.1 |
| Minimum machinery around the turn workflow | P0.4 (audit table), phase-3 (P3.1–P3.4), P7.4 |
| Own ModelAdapter, no AI SDK in the runner | P0.1 note, P2.2 D5 |
| authz-engine replaces the gRPC authz | phase-4 (P4.1–P4.5) |
| Long-lived worker outside Vercel | P6.1, P6.2 |

## Status of every unit

Status is copied from each spec header. Rounds are independent spec-reviewer rounds (max 3). "unresolved" lists review findings accepted open by owner request.

| Unit | Title | Architecture | Arch rounds / final | Program | Prog rounds / final | Tickets |
|------|-------|--------------|---------------------|---------|---------------------|---------|
| P0.1 | [Current-state map of one agent turn](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md) | BINDING through pass 1 | 1 / ready | [BINDING through pass 2](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_PROGRAM.md) | 2 / ready | [2](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP_TICKETS.md) |
| P0.2 | [Temporal inventory and what the machinery around it is for](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md) | BINDING through pass 2 | 2 / ready | [BINDING through pass 1](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY_TICKETS.md) |
| P0.3 | [DBOS fit: each need mapped to a DBOS 5.4.0 API](phase-0/PHASE0_P0.3_DBOS_FIT.md) | BINDING through pass 3 | 3 / ready | [BINDING through pass 1](phase-0/PHASE0_P0.3_DBOS_FIT_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.3_DBOS_FIT_TICKETS.md) |
| P0.4 | [Simplification audit of the machinery around the turn workflow](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) | BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04 | 3 / not-ready | [BINDING through pass 1](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_PROGRAM.md) | 1 / ready | [2](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT_TICKETS.md) |

## BINDING with unresolved findings

- **P0.4 Simplification audit of the machinery around the turn workflow**: architecture R3-F1, R3-F2 — see `phase-0/reviews/`.

## Cross-phase documents

- Product contract: [`../README.md`](../README.md).
- Project profile (stack, layering, testing, tickets): [`../factory/profile/navier_dbos/README.md`](../factory/profile/navier_dbos/README.md).
- Factory config: [`../factory/config.yaml`](../factory/config.yaml).
- Source trees (cited `tree/path:a-b`, every range checked by the validator): navier `/workspace/attach/navier/src` @ `zip 2026-11-04` (owner code, read-only); dbos `/workspace/dbos-agent/node_modules/@dbos-inc/dbos-sdk` @ `5.4.0` (MIT); proto `/workspace/dbos-agent` @ `no-vcs` (owner prototype); aze `/workspace/authz-engine` @ `design 2026-11-03` (owner design). Each phase has `indexing/`.
- Current-state map and Temporal inventory: [P0.1](phase-0/PHASE0_P0.1_CURRENT_STATE_MAP.md), [P0.2](phase-0/PHASE0_P0.2_TEMPORAL_INVENTORY.md); simplification audit table: [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md).

## Gates for owner

Every D and PD pick was delegated to the designer (request pt151u) and recorded as "recommend-A". **The owner has not answered any of them.** Owner decisions already given (DBOS only maintained runner, frozen Temporal, no AI SDK, keep delta table + SSE hub, worker outside Vercel, keep tables and drain, authz-engine) are not gates. The most consequential picks, per phase:

**Phase 0 — Research and map**

- [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D1 — minimum rule: delete every piece whose only job is to cover a Temporal gap DBOS closes, keep product behaviour (A) vs port the Temporal machinery 1:1 onto DBOS first and simplify later (B).
- [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D3 — per-agent-version `maxRecoveries` becomes one global `maxRecoveryAttempts` on the turn workflow, enforced per version only by the audit sweep (A) vs keep per-version restarts in an app-level table (B).
- [P0.3](phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 — DBOS system schema lives in the same Postgres database as Navier (schema `dbos`) so starts and messages commit with Navier rows (A) vs a separate system database (B).

## Decision log

| Date | Decision | Picked by | Status |
|------|----------|-----------|--------|
| 2026-11-04 | Design-only project; phases 0–0, 4 units, three artifacts each | owner request (pt151u) | recorded |
| 2026-11-04 | DBOS is the only maintained runner; Temporal frozen behind the runner seam (compiles, passes its tests, no new work) | owner | recorded |
| 2026-11-04 | No Vercel AI SDK in the runner; `llm/` ModelAdapter unchanged | owner (pt151u) | recorded |
| 2026-11-04 | Keep Postgres delta table + SSE hub; worker long-lived outside Vercel; keep tables, drain Temporal | owner | recorded |
| 2026-11-04 | Replace identity/authz* and the cosmos.authz.v1 gRPC client with authz-engine (new phase 4); authz pluggable in open source | owner (follow-up) | recorded |
| 2026-11-04 | Every unit BINDING after at most 3 review rounds; not-ready after round 3 recorded as BINDING with unresolved findings | owner request (pt151u) | recorded |
| 2026-11-04 | [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D1 — minimum rule: delete every piece whose only job is to cover a Temporal gap DBOS closes, keep product behaviour (A) vs port the Temporal machinery 1:1 onto DBOS first and simplify later (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P0.4](phase-0/PHASE0_P0.4_SIMPLIFICATION_AUDIT.md) D3 — per-agent-version `maxRecoveries` becomes one global `maxRecoveryAttempts` on the turn workflow, enforced per version only by the audit sweep (A) vs keep per-version restarts in an app-level table (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
| 2026-11-04 | [P0.3](phase-0/PHASE0_P0.3_DBOS_FIT.md) D2 — DBOS system schema lives in the same Postgres database as Navier (schema `dbos`) so starts and messages commit with Navier rows (A) vs a separate system database (B). | delegated to designer (pt151u), recommend-A | **awaiting owner** |
