# P4.1 Authz seam and call-site inventory — program design

Status: BINDING through pass 1
Architecture: [`PHASE4_P4.1_AUTHZ_SEAM.md`](PHASE4_P4.1_AUTHZ_SEAM.md) (BINDING through pass 2).
Depends on: [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md) architecture.
Tickets: [`PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md`](PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md). Review: [`reviews/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM_REVIEW.md`](reviews/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM_REVIEW.md).

## Contents

| Id / heading | Location |
|--------------|----------|
| Implementation explained | [Implementation explained](#implementation-explained) |
| Types, signatures, and caller contracts | [Types, signatures, and caller contracts](#types-signatures-and-caller-contracts) |
| Architecture rules mapped to owners | [Architecture rules mapped to owners](#architecture-rules-mapped-to-owners) |
| Program layout and construction | [Program layout and construction](#program-layout-and-construction) |
| Call graph and execution flow | [Call graph and execution flow](#call-graph-and-execution-flow) |
| Test seams | [Test seams](#test-seams) |
| Call sites and integration | [Call sites and integration](#call-sites-and-integration) |
| PD1 | [Seam + legacy first](#pd1--seam--legacy-first) |
| PD2 | [Engine adapter later](#pd2--engine-adapter-later) |
| PD3 | [Port in four groups](#pd3--port-in-four-groups) |

## Implementation explained

The seam and the legacy adapter land first and every site ports to it with behaviour unchanged (PD1). The engine adapter lands with [P4.2](PHASE4_P4.2_NAVIER_MODEL.md) and [P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md) (PD2).

## Types, signatures, and caller contracts

```ts
// src/authz/types.ts
export type Who = { kind: 'user'; id: PrincipalId } | { kind: 'agent'; id: PrincipalId; actingFor?: PrincipalId } | { kind: 'service' };
export type NavierObject = { type: 'org' | 'agent' | 'agent_version' | 'tool' | 'space' | 'conversation' | 'fs' | 'sandbox' | 'model'; id?: string };
export type Decision = { allow: true } | { allow: false; reason: 'no_grant' | 'not_visible' | 'unavailable' | 'invalid_scope' };
export interface NavierAuthz {
  checks: { can(tx: Tx | undefined, org: OrgId, who: Who, action: Action, object: NavierObject): Promise<Result<Decision>>;
            canAll(tx: Tx | undefined, org: OrgId, who: Who, items: readonly [Action, NavierObject][]): Promise<Result<Decision[]>>;
            agentUse(tx: Tx | undefined, org: OrgId, who: Who, q: readonly AgentUseQuery[]): Promise<Result<AgentUse[]>>;
            objects(tx: Tx | undefined, org: OrgId, who: Who, objs: readonly NavierObject[], action: Action): Promise<Result<Decision[]>> };
  writes: { /* grant, revoke, delegate, registerAgent, registerTool, registerConversation, writeToolSpaces, publishAgentVersion, setAgentPublished, writeSpaceRoles, grants, markings.* — each (tx | undefined, caller, org, ...) */ };
  reads: { listGrants(...): Promise<Result<Page<Grant>>>; listGrantable(...): Promise<Result<Grantable[]>>; listAuditEvents(...): Promise<Result<Page<AuditEvent>>> };
  probe(): ReadinessProbe;
}
```

[pass 1]

## Architecture rules mapped to owners

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| D1 | `src/authz/types.ts` | interface |
| D2 | adapters | mapping |
| D3 | port tickets | each site |
| D5 | `agents/store.ts` | no row write |
| L1 | `commands.deps` | rule |
| L2 | adapters | error mapping table |

[pass 1]

## Program layout and construction

```text
src/authz/types.ts
src/authz/index.ts
src/authz/legacy/adapter.ts        (wraps identity/authz.ts + authz-admin.ts until P4.5)
src/authz/engine/adapter.ts        (P4.3)
src/authz/engine/model/navier.fga  (P4.2)
```

[pass 1]

## Call graph and execution flow

route/step → `authz.checks.can(tx, org, who, action, obj)` → adapter (legacy gRPC | engine `as(p).tx(...).check`). [pass 1]

## Test seams

Seam conformance tests shared by both adapters. [pass 1]

## Call sites and integration

All sites in the architecture inventory. [pass 1]

## Landing decisions

### PD1 — Seam + legacy first

Port all sites with no behaviour change. [pass 1]

### PD2 — Engine adapter later

After the model and tx integration. [pass 1]

### PD3 — Port in four groups

runtime; agents/catalog/models/orgconfig; sdk-publish; api + composition. [pass 1]

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | BINDING | PD1, PD2, PD3, types, owners, layout, callgraph, seams, callsites | Initial program spec. Reviewed in [round 1](reviews/PHASE4_P4.1_AUTHZ_SEAM_PROGRAM_REVIEW.md#round-1) — VERDICT ready. | PD1: port straight to the engine — no shadow phase | delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready |
