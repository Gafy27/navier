# P4.3 Identity propagation and checks inside DBOS steps — program design

Status: BINDING through pass 2
Architecture: [`PHASE4_P4.3_WORKFLOW_AUTHZ.md`](PHASE4_P4.3_WORKFLOW_AUTHZ.md) (BINDING through pass 2).
Depends on: [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md) architecture.
Tickets: [`PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md`](PHASE4_P4.3_WORKFLOW_AUTHZ_TICKETS.md). Review: [`reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| PD1 | [tx required on runtime paths](#pd1--tx-required-on-runtime-paths) |
| PD2 | [One principal loader](#pd2--one-principal-loader) |

## Implementation explained

The engine adapter implements the seam with `tx` required for checks on runtime paths (PD1). A `principalOf(tx, org, messageId)` loader reads the request context row (PD2).

## Types, signatures, and caller contracts

```ts
export function createEngineAuthz(engine: AuthzEngine, log: Logger): NavierAuthz;
export async function principalOf(tx: Reader, org: OrgId, agentMessageId: string): Promise<Result<Who>>;  // agent acting for posting user
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D2 | `engine/adapter.ts` | `as(p).tx(tx)` |
| D3 | `runtime/tool-call.ts` | check before claim |
| D4 | `runtime/decide.ts` | check in tx |
| D7 | `engine/errors.ts` | table |
| L1 | adapter | no cache |

[pass 2]

## Landing decisions

### PD1 — tx required on runtime paths

Type overload: runtime callers must pass `tx`. [pass 1]

### PD2 — One principal loader

Used by steps and decide. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | PD1, PD2, types, owners | Initial program spec. Reviewed in [round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | PD1: optional everywhere — a runtime check outside tx | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | owners | Review fixes for R1-F1 ([round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md#round-2) — VERDICT ready. | — | [review round 1](reviews/PHASE4_P4.3_WORKFLOW_AUTHZ_PROGRAM_REVIEW.md#round-1); BINDING by owner request (pt151u) after VERDICT ready |
