# P4.1 Authz seam and call-site inventory: `NavierAuthz` = what Navier asks today, in Navier terms; legacy and authz-engine adapters behind it

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P1.1](../phase-1/PHASE1_P1.1_RUNNER_INTERFACE.md) (same seam pattern).
Program: [`PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md`](PHASE4_P4.1_AUTHZ_SEAM_PROGRAM.md). Review: [`reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md`](reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md).
Sources: research [navier-authz-surface](indexing/navier-authz-surface.md), [authz-engine-contract](indexing/authz-engine-contract.md).

## Design explained

**What Navier asks today (D2).**

| Today | Seam method | authz-engine verb |
|-------|-------------|-------------------|
| `check(org, who, scope)` `navier/identity/authz.ts:51-55` | `checks.can(tx?, who, action, object)` | `as(who).check` |
| `checkMany` `navier/identity/authz.ts:95-100` | `checks.canAll(tx?, who, items)` | `check` × n in one `tx` |
| `checkAgentUse` `navier/identity/authz.ts:101-105` | `checks.agentUse(tx?, who, queries)` → open / direct / not_visible | `check(use, agent)` + `list(use, agent_version)` |
| `checkObjects` `navier/identity/authz-admin.ts:64-69` | `checks.objects` | `check` per object |
| `grant` / `revoke` `navier/identity/authz.ts:61-77` | `writes.grant` / `writes.revoke` | `write` |
| `delegate` `navier/identity/authz.ts:78-88` | `writes.delegate(parent, child, scopes)` | `write` guarded by parent's relations |
| `registerAgent`, `registerTool`, `registerConversation` `navier/identity/authz.ts:89-110`, `navier/identity/authz-admin.ts:123-130` | `writes.register*` | `write` (create + owner tuple) |
| `writeToolSpaces`, `publishAgentVersion`, `setAgentPublished`, `writeSpaceRoles` `navier/identity/authz.ts:111-146` | `writes.*` same names | `write` batches |
| `writeGrants`, markings ×5 `navier/identity/authz-admin.ts:70-116` | `writes.grants`, `writes.markings.*` | `write` (`@deny` relations) |
| `listGrants`, `listGrantable`, `listAuditEvents` `navier/identity/authz-admin.ts:75-122` | `reads.*` | `list`, `explain`, audit export |

**Seam (D1).** `NavierAuthz` is intent-level: it names Navier objects (`agent`, `tool`, `space`, `conversation`, `org`) and actions, returns Navier's `Decision` (allow, or deny with `no_grant` / `not_visible` / `unavailable` / `invalid_scope`, `navier/identity/decision.ts:1-14`), and takes an optional `tx` so the authz-engine adapter checks and writes inside the caller's transaction ([P4.3](PHASE4_P4.3_WORKFLOW_AUTHZ.md)). The legacy adapter wraps today's client and ignores `tx`.

**Inventory (D3).** Every site moves to the seam ([P4.5](PHASE4_P4.5_GRPC_REMOVAL.md) deletes the old types):

| Area | Sites |
|------|-------|
| runtime | `navier/runtime/tool-call.ts:356`, `navier/runtime/decide.ts:174`, `navier/runtime/decide.ts:190`, `navier/runtime/edge.ts:20-43`, `navier/runtime/stop.ts:84`, `navier/runtime/post.ts:100`, `navier/runtime/blocked.ts:101`, `navier/runtime/result.ts:43` |
| agents | `navier/agents/head.ts:95`, `navier/agents/store.ts:232`, `navier/agents/store.ts:415`, `navier/agents/use.ts:26`, `navier/agents/use.ts:63`, `navier/agents/use.ts:83`, `navier/agents/publish.ts:92`, `navier/agents/publish.ts:101`, `navier/agents/publish.ts:127` |
| catalog / models / orgconfig | `navier/catalog/placement.ts:38`, `navier/catalog/placement.ts:56`, `navier/catalog/serving.ts:98`, `navier/catalog/catalog.ts:262`, `navier/catalog/list.ts:21`, `navier/models/policy.ts:75`, `navier/orgconfig/index.ts:136`, `navier/orgconfig/index.ts:212`, `navier/orgconfig/index.ts:307` |
| sdk-publish | `navier/sdk-publish/orgconfig-admin.ts:56`, `navier/sdk-publish/project-admin.ts:50`, `navier/sdk-publish/project-admin.ts:73`, `navier/sdk-publish/publish.ts:237`, `navier/sdk-publish/publish.ts:253`, `navier/sdk-publish/publish.ts:271`, `navier/sdk-publish/admin.ts:42`, `navier/sdk-publish/admin.ts:122`, `navier/sdk-publish/admin.ts:212` |
| api | `navier/api/routes/authz/grant-inputs.ts:135`, `navier/api/routes/authz/grant-inputs.ts:177`, `navier/api/routes/authz/handler.ts:128`, `navier/api/routes/authz/handler.ts:191`, `navier/api/routes/authz/handler.ts:279`, `navier/api/routes/authz/handler.ts:542`, `navier/api/routes/authz/handler.ts:602`, `navier/api/routes/authz/handler.ts:613`, `navier/api/routes/authz/handler.ts:630`, `navier/api/routes/authz/handler.ts:643`, `navier/api/routes/authz/handler.ts:664`, `navier/api/routes/authz/handler.ts:729`, `navier/api/routes/authz/directory.ts:116`, `navier/api/routes/authz/directory.ts:165`, `navier/api/routes/chat/handler.ts:151`, `navier/api/adapter/check.ts:31`, `navier/api/adapter/check.ts:47`, `navier/api/adapter/app.ts:36`, `navier/api/conversation-access.ts:30` |
| composition | `navier/api.ts:117-118`, `navier/worker.ts:166`, `navier/sdk/runtime.ts:150` |

**Scopes (D4).** `scope.ts` strings (`navier/identity/scope.ts:4-35`) become typed `(action, object)` pairs from the generated model types; the `<org>~<encoded>` id rule (`navier/identity/scope-map.ts:44-60`) moves into the adapter.

**Agent principal (D5).** `createAgentPrincipal` writes a local row (`navier/identity/agent-principal.ts:22-54`, called at `navier/agents/store.ts:232`); it does not depend on the gRPC client. With authz-engine the agent's principal is the subject `agent:<org>~<agentId>` created by `writes.registerAgent`; the row is no longer written and its reader (`navier/sdk-publish/admin.ts:122`) reads the seam. The table stays (owner decision 5).

## Context and scope

The steering request names `identity/authz.ts`, `authz-admin`, `authz-config`, the generated client, `scope-map`, `scope`, `decision` and `agent-principal` for removal.

## Goals and non-goals

**Goals**

- **G1 —** Every call site uses the seam.
- **G2 —** Two adapters (legacy, engine) pass the same seam tests.

**Non-goals**

- A generic authz plugin SDK beyond the seam (open source uses the seam itself, [P7.3](../phase-7/PHASE7_P7.3_OSS_READINESS.md)).

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| `checks` | decisions | Navier `Decision` | engine `check` |
| `writes` | tuples | `Result<void>` | engine `write` |
| `reads` | listings, audit | pages | engine `list` |
| Adapters | legacy, engine | same seam | [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) |

## Decisions and rationale

### D1 — Intent-level seam, three ports

`checks`, `writes`, `reads`; optional `tx`. [pass 2]

### D2 — Method mapping

Table above: all 23 methods. [pass 2]

### D3 — Call-site inventory

Table above; each site ported by [P4.1 tickets](PHASE4_P4.1_AUTHZ_SEAM_TICKETS.md). [pass 2]

### D4 — Typed actions instead of scope strings

Generated model types. [pass 1]

### D5 — Agent principal = engine subject

`agent_principal` row no longer written. [pass 2]

## Invariants

- **L1 —** No code outside `src/authz/` imports an authz implementation. [pass 1]
- **L2 —** Every seam failure is a deny `unavailable` or an `unavailable` error — never an allow. [pass 2]

## Relevant cross-cutting concerns

Fail-closed matches authz-engine errors (`aze/phases/phase-4/PHASE4_P4.3_TYPEGEN_ERRORS.md:56-58`).

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md#round-1) — VERDICT fix-then-ready. | D1: engine SDK at every call site — shadow mode impossible; D4: keep scope strings — parsing in two places | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D3, D2, D1 | Review fixes for R1-F1, R1-F2, R1-F3 ([round 1](reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md#round-2) — VERDICT ready. | D5: keep writing the row — two sources of agent identity | [review round 1](reviews/PHASE4_P4.1_AUTHZ_SEAM_REVIEW.md#round-1); new D5, L2 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
