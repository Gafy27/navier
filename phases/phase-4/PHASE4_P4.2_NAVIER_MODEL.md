# P4.2 Navier as an authz-engine model: `navier.fga`: org, user, agent, agent_version, space, tool, conversation, marking, fs/sandbox/model; acting-for intersection; approvals as rows

Status: BINDING through pass 3
Depends on: product contract [`README.md`](../../README.md); [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md).
Program: [`PHASE4_P4.2_NAVIER_MODEL_PROGRAM.md`](PHASE4_P4.2_NAVIER_MODEL_PROGRAM.md). Review: [`reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md`](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md).
Sources: research [authz-engine-contract](indexing/authz-engine-contract.md), [navier-authz-surface](indexing/navier-authz-surface.md); template `aze/phases/phase-6/PHASE6_P6.2_AGENTS_TOOLS.md:1-60`.

## Design explained

**Model (D1)** (`src/authz/engine/model/navier.fga`, ids `<org>~<encoded id>` as today, `navier/identity/scope-map.ts:44-60`):

```fga
model
  schema 1.1
type user
type service
type org
  relations
    define admin: [user]
    define member: [user] or admin
    define config: admin                       # org:config
    define model_admin: [user] or admin        # model:admin
    define agent_create: [user] or admin       # agent_create:create
    define tool_create: [user] or admin        # tool_create:create
type space
  relations
    define org: [org]
    define editor: [user] or admin from org
    define member: [user, agent] or editor
type agent
  relations
    define org: [org]
    define owner: [user]
    define writer: [user] or owner or admin from org      # agent:write
    define admin: [user] or owner or admin from org       # agent:admin
    define published: [org#member]
    # @visible(use)
    define use: owner or published
type agent_version
  relations
    define agent: [agent]
    define publisher: [user]
    define use: use from agent
type tool
  relations
    define org: [org]
    define space: [space]
    define assign: [user] or editor from space or admin from org     # tool:assign
    define enable: [user] or admin from org                           # tool:enable
    define register: [user] or admin from org                         # tool:register
    define pinned: [agent]                                            # written at publish
    define invoke: [user] or member from space or pinned              # tool:invoke
type conversation
  relations
    define org: [org]
    define owner: [user]
    define decide: owner                                              # approvals on this thread
type marking
  relations
    define cleared: [user, agent]
# @deny(view: marked_by)  — marking deny layer over agents/tools/spaces
type fs
  relations
    define read: [user, agent]
    define write: [user, agent]
type sandbox
  relations
    define exec: [user, agent]
```

Markings map to authz-engine's deny layer (`@deny`, `aze/README.md:19`): an object with a marking is invisible to a subject not `cleared` for it [U exact `@deny` syntax, owned by authz-engine P1.1].

**Agents and delegation (D2).** An agent runs with principal `{ type: 'agent', id: '<org>~<agentId>', actingFor: { type: 'user', id: <posting user> } }` (`aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md:55-57`). authz-engine evaluates an acting-for check as the **intersection**: both the agent and the user must hold the relation (`aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md:63-65`). Law L1: an agent acting for a user is never allowed what the user is not allowed (`aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md:89`). `delegate(parent, child, scopes)` (`navier/identity/authz.ts:78-88`) becomes a write of the same relations to `agent:child`, accepted only when `agent:parent` holds each (engine write guard).

**Tool call (D3).** Today the step checks only that the version's publisher still holds `tool:assign` (`navier/runtime/tool-call.ts:350-361`); the user's `tool:invoke` is checked at post and decide (`navier/runtime/edge.ts:20-43`). After: the step checks (a) `user:publisher assign tool:K` (unchanged meaning) **and** (b) `as({agent, actingFor: user}).check(invoke, tool:K)` — so a tool runs only where the agent (pinned at publish) and the user (space membership or grant) are both allowed. (b) is a tightening requested by the owner: a user who lost `invoke` between post and tool call is now denied at the step.

**Approvals (D4).** Approval levels, decisions and remembered approvals stay Navier rows (`action_decision`, `approval_memory`, `navier/runtime/approval.ts:41-84`). authz-engine decides only **who may decide**: `conversation:T#decide` (the thread owner, today's `requireOwnThread`, `navier/runtime/decide.ts:164-196`) plus `use` on the agent version and `invoke` on the tools. authz-engine's expiring-grant approvals (`aze/phases/phase-5/PHASE5_P5.2_AGENT_GUARDS_MCP.md:71-73`) are the rejected alternative.

**Tuple mapping (D5).**

| Legacy write | Tuples |
|--------------|--------|
| `registerAgent(caller, agentId)` | `agent:A#org@org:O`, `agent:A#owner@user:caller` |
| `publishAgentVersion(agentId, v, pins)` | `agent_version:A~v#agent@agent:A`, `#publisher@user:caller`, `tool:K#pinned@agent:A` per pin, `tool:K#space@space:S` |
| `setAgentPublished(true)` | `agent:A#published@org:O#member` |
| `registerTool`, `writeToolSpaces` | `tool:K#org@org:O`, `tool:K#space@space:S` |
| `writeSpaceRoles` | `space:S#editor|member@user:P` |
| `grant/revoke(to, scopes)` | one tuple per scope: `resource:id#action@user:to` (relation names = actions above) |
| `registerConversation` | `conversation:T#org@org:O`, `#owner@user:caller` |
| markings | `marking:M#cleared@...`, deny tuples on marked objects |

**AgentUse (D6).** `checkAgentUse` answers `open` (with version), `direct` or `not_visible` (`navier/identity/authz.ts:266-300`): `direct` = `use` on `agent`; `open` = `use` on the newest published `agent_version` the user may use (`list`); `not_visible` from the engine's tri-state.

**Scenarios (D7).** `navier.scenarios.authz.yaml` covers every mapping row and the intersection law, run by authz-engine's test runner (`aze/phases/phase-6/PHASE6_P6.2_AGENTS_TOOLS.md:1-60`).

## Context and scope

The owner's agent template (P6.2) is the starting point; Navier adds orgs, spaces, versions, conversations and markings.

## Goals and non-goals

**Goals**

- **G1 —** Every legacy method has a tuple mapping.
- **G2 —** The intersection law holds in scenarios.

**Non-goals**

- Changing approval policy.
- Non-Postgres dialects.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Model | types/relations | `navier.fga` | authz-engine compiler |
| Agent principal | acting-for | intersection | aze P5.2 |
| Mapping | legacy writes → tuples | table | [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) import |
| Scenarios | expected decisions | yaml | aze test runner |

## Decisions and rationale

### D1 — One Navier model

As above. [pass 3]

### D2 — Agent acts for the user by intersection

Delegation = relation copy guarded by the parent. [pass 1]

### D3 — Tool-call check = publisher assign ∧ (agent ∩ user) invoke

Owner-requested tightening. [pass 1]

### D4 — Approvals stay rows

Engine decides who may decide. [pass 1]

### D5 — Tuple mapping

Table above. [pass 1]

### D6 — AgentUse via check + list

open / direct / not_visible preserved. [pass 2]

### D7 — Scenario file

Every mapping row + law. [pass 1]

## Invariants

- **L1 —** An agent acting for a user is never allowed an action the user is not allowed. [pass 1]

## Unresolved questions and blockers

| Id | Assumption or unknown | Source or evidence gap | Affected decision / blocked work | Resolution needed |
|----|-----------------------|------------------------|----------------------------------|-------------------|
| B1 | `@deny` syntax and semantics for markings | aze P1.1 annotations | D1 markings | confirm with authz-engine before [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) import [pass 3] |

## Relevant cross-cutting concerns

Ids never contain PII beyond today's principal ids.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D3, D4, D5, D7, L1 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-1) — VERDICT fix-then-ready. | D2: agent-only checks — violates L1; D3: keep publisher-only check — owner asked for both-allowed; D4: expiring grants — moves product state into authz and changes remembered-approval semantics | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | draft (superseded by next pass) | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-2) — VERDICT fix-then-ready. | — | [review round 1](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-1); new D6 delegated to designer (pt151u), recommend-A |
| 3 | 2026-11-04 | BINDING | D1 | Review fixes for R2-F1 ([round 2](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-2)). Reviewed in [round 3](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-3) — VERDICT ready. | — | [review round 2](reviews/PHASE4_P4.2_NAVIER_MODEL_REVIEW.md#round-2); new B1 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
