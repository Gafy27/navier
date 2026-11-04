# P4.4 Migration and cutover from the old authz service — program design

Status: BINDING through pass 3 — unresolved: R3-F1, R3-F2; accepted by owner request (pt151u) 2026-11-04
Architecture: [`PHASE4_P4.4_AUTHZ_CUTOVER.md`](PHASE4_P4.4_AUTHZ_CUTOVER.md) (BINDING through pass 1).
Depends on: [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) architecture.
Tickets: [`PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md`](PHASE4_P4.4_AUTHZ_CUTOVER_TICKETS.md). Review: [`reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| PD1 | [Shadow as composition](#pd1--shadow-as-composition) |
| PD2 | [Outbox table](#pd2--outbox-table) |
| PD3 | [Markings parity check](#pd3--markings-parity-check) |

## Implementation explained

The shadow adapter composes the two adapters (PD1). Outbox rows live in a Navier-owned table created by this unit — the only schema addition of the project (PD2).

## Types, signatures, and caller contracts

```ts
export function createShadowAuthz(primary: NavierAuthz, secondary: NavierAuthz, diff: DiffSink): NavierAuthz;
export interface DiffRecord { org: OrgId; site: string; action: Action; objectType: NavierObject['type']; primary: Decision; secondary: Decision }
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D2 | `shadow.ts` | mode per org |
| D3 | `shadow.ts` | diff sink |
| D4 | `outbox.ts` | outbox + reconcile |
| D1 | `scripts/authz/*` | job |

[pass 3]

## Program layout and construction

```text
src/authz/shadow.ts
src/authz/outbox.ts
src/authz/migrations/authz_outbox.ts
scripts/authz/export.ts
scripts/authz/import.ts
scripts/authz/reconcile.ts
```

[pass 1]

## Landing decisions

### PD1 — Shadow as composition

No change to either adapter. [pass 1]

### PD2 — Outbox table

`authz_outbox` (org, seq, target, batch ids); dropped by [P4.5](PHASE4_P4.5_GRPC_REMOVAL.md). [pass 2]

### PD3 — Markings parity check

Import verifies every marked object is invisible to uncleared subjects in the engine. [pass 2]

## Unresolved questions and blockers

Open review findings at BINDING: R3-F1, R3-F2 — see [`reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, types, owners, layout | Initial program spec. Reviewed in [round 1](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-1) — VERDICT not-ready. | PD2: no outbox — lost writes on partial failure | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | PD2 | Review fixes for R1-F1 ([round 1](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-2) — VERDICT not-ready. | — | [review round 1](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-1); new PD3 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | owners | Review fixes for R2-F1 ([round 2](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-3) — VERDICT not-ready. | — | [review round 2](reviews/PHASE4_P4.4_AUTHZ_CUTOVER_PROGRAM_REVIEW.md#round-2); BINDING by owner request (pt151u) after round 3 not-ready — unresolved R3-F1, R3-F2 accepted as recorded in the review file |
