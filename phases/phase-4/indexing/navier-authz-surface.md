# Navier authorization surface and call sites

**Kind:** module
**Source:** `/workspace/attach/navier/src` (Navier src (navier.zip), owner code, read-only, pin `zip 2026-11-04`). Cites below are `tree/path:line` relative to each root.
**Concerns:** P4.1, P4.2, P4.5
**Verdict axis:** live
**Status:** ready

**Question:** What does Navier ask of authz-api, from where, and what depends on the gRPC client?

## Answer in plain language

`Authz` offers check, checkMany, checkAgentUse (open / direct / not_visible), grant, revoke, delegate (agent to agent), registerAgent, registerTool, writeToolSpaces, publishAgentVersion, setAgentPublished and writeSpaceRoles over connect-rpc to `cosmos.authz.v1`, with a service token. `AuthzAdmin` adds checkObjects, grants listing, grantable listing, marking categories/markings/roles/apply/remove, audit events and registerConversation. Scopes are strings `resource:action[:id]` over eight resources; objects are `<org>~<encoded id>`; decisions are allow or deny with four reasons. About 60 call sites in 30 files use them. `agent-principal.ts` is a local table, not a gRPC user; `service-token.ts` is also used by the CLI.

## Why it matters for this project

Every method maps to one authz-engine verb; the seam keeps call sites stable during shadow mode.

## How it works

Read `identity/` and grepped every consumer.

## Key findings and evidence

- Authz interface. [S] `navier/identity/authz.ts:46-146`
- AgentUse answers. [S] `navier/identity/authz.ts:266-300`
- createAuthz. [S] `navier/identity/authz.ts:305`
- AuthzAdmin interface. [S] `navier/identity/authz-admin.ts:62-130`
- Config. [S] `navier/identity/authz-config.ts:1-22`
- Scope resources/actions. [S] `navier/identity/scope.ts:4-35`
- Object ids. [S] `navier/identity/scope-map.ts:6-60`
- Decision. [S] `navier/identity/decision.ts:1-14`
- Agent principal row. [S] `navier/identity/agent-principal.ts:11-54`
- gRPC service. [S] `navier/identity/gen/cosmos/authz/v1/authz_pb.d.ts:1182-1260`
- Tool-call check (publisher assign). [S] `navier/runtime/tool-call.ts:323-364`
- Decide authorize. [S] `navier/runtime/decide.ts:164-196`
- Edge invoke checkMany. [S] `navier/runtime/edge.ts:20-43`

## Limits and unknowns

The authz-api server is not in the zip; its semantics are inferred from the client.

## Research recommendation

**Recommendation:** adapt — intent-level seam mirroring these methods; authz-engine default; legacy adapter until cutover.
**Why / consequences:** Call sites keep their shape through shadow mode.
**Do not copy:** Cite. Notes describe and cite; no product code enters this repository.

## Technical references

### File map

#### P0 — read first

| File / source | What question it helps verify |
|---------------|-------------------------------|
| `navier/identity/authz.ts` | client |
| `navier/identity/authz-admin.ts` | admin |

#### P1 — implementation detail

| File / source | When to open it |
|---------------|-----------------|
| `navier/identity/scope.ts` | scopes |

#### Skip

| Path / source | Why it is outside this question |
|---------------|---------------------------------|
| `navier/identity/service-token.ts` | shared with CLI, kept |
