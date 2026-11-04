# P4.5 Removal of the old gRPC authz client: delete `identity/authz*`, the generated `cosmos.authz.v1` and health clients, `scope`, `scope-map`, `decision`, `agent-principal`; drop the legacy adapter, outbox and config

Status: BINDING through pass 2
Depends on: product contract [`README.md`](../../README.md); [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) (all orgs `engine` for 14 days).
Program: [`PHASE4_P4.5_GRPC_REMOVAL_PROGRAM.md`](PHASE4_P4.5_GRPC_REMOVAL_PROGRAM.md). Review: [`reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md`](reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md).
Sources: research [navier-authz-surface](indexing/navier-authz-surface.md).

## Design explained

**Delete (D1).** `identity/authz.ts` (`navier/identity/authz.ts:1-728`), `identity/authz-admin.ts` (`navier/identity/authz-admin.ts:1-382`), `identity/authz-config.ts` (`navier/identity/authz-config.ts:1-22`) and their tests; `identity/gen/cosmos/authz/v1/*` (`navier/identity/gen/cosmos/authz/v1/authz_pb.d.ts:1182-1260`) and `identity/gen/grpc/health/v1/*` (only `authz.ts` uses it); `identity/scope-map.ts` (`navier/identity/scope-map.ts:1-120`); `identity/agent-principal.ts` (`navier/identity/agent-principal.ts:1-71`); `src/authz/legacy/`, `src/authz/shadow.ts`, `src/authz/outbox.ts` and the scripts of [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md).

**Moved, then deleted (D2).** `identity/decision.ts` (`navier/identity/decision.ts:1-14`) → `src/authz/types.ts` `Decision` ([P4.1](PHASE4_P4.1_AUTHZ_SEAM.md)); `identity/scope.ts` (`navier/identity/scope.ts:1-172`) → action names are model relations; the API's `scope:"…"` request strings, if any remain on the wire, parse in `api/routes/authz/` into typed pairs.

**Kept (D3).** `identity/service-token.ts` (the CLI uses it, `navier/cli/commands/auth/service-token.ts:1-10`), `principal.ts`, `caller.ts`, `request.ts` (scope requests become typed in place).

**Dependencies (D4).** Remove `@connectrpc/connect`, `@connectrpc/connect-node`, `@bufbuild/protobuf` if no other importer remains (today only `identity/`).

**Config (D5).** Remove `AUTHZ_API_URL`, `AUTHZ_TLS`, `AUTHZ_TIMEOUT_MS`, `AUTHZ_CHECK_MAX_ITEMS`, `AUTHZ_TOKEN_URL`, `AUTHZ_CLIENT_ID`, `AUTHZ_CLIENT_SECRET_FILE`, `AUTHZ_AUDIENCE`, `AUTHZ_MODE*`.

**Schema (D6).** Drop `authz_outbox` (temporary, [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) PD2). `agent_principal` table stays (owner decision 5), unwritten.

## Context and scope

The steering request lists these files.

## Goals and non-goals

**Goals**

- **G1 —** No import of the old client or generated code remains.
- **G2 —** Rollback window closed deliberately.

**Non-goals**

- Removing tables other than the temporary outbox.

## Responsibilities and dependencies

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| Deletion | files | gone | D1 |
| Moves | types | src/authz | [P4.1](PHASE4_P4.1_AUTHZ_SEAM.md) |
| Kept | shared files | unchanged | CLI |
| Deps/config | packages, keys | removed | package.json |

## Decisions and rationale

### D1 — Deletion list

As above. [pass 2]

### D2 — decision and scope moved first

Then deleted. [pass 1]

### D3 — Kept files

service-token, principal, caller, request. [pass 2]

### D4 — Drop connect/protobuf deps

If unused. [pass 1]

### D5 — Drop AUTHZ_* config

All keys. [pass 1]

### D6 — Drop outbox only

agent_principal stays. [pass 1]

## Relevant cross-cutting concerns

Closes the rollback window of [P4.4](PHASE4_P4.4_AUTHZ_CUTOVER.md) D6.

## Changelog

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| 1 | 2026-11-04 | draft (superseded by next pass) | D1, D2, D4, D5, D6 | Initial architecture spec. Reviewed in [round 1](reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md#round-1) — VERDICT fix-then-ready. | D6: drop agent_principal — owner keeps tables | delegated to designer (pt151u), recommend-A |
| 2 | 2026-11-04 | BINDING | D1 | Review fixes for R1-F1 ([round 1](reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md#round-1)). Reviewed in [round 2](reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md#round-2) — VERDICT ready. | D3: delete service-token — breaks the CLI | [review round 1](reviews/PHASE4_P4.5_GRPC_REMOVAL_REVIEW.md#round-1); new D3 delegated to designer (pt151u), recommend-A; BINDING by owner request (pt151u) after VERDICT ready (program pass needs BINDING architecture) |
