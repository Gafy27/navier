# Requirements

Service laws, layout, phases. Agent behavior lives in [`rules.md`](../policy/rules.md).
This file points to the sources of truth and does not restate them.

## Objective

**authz-api** is a standalone TypeScript service that answers access decisions
for the Cosmos platform over gRPC. It verifies Auth0 JWTs, owns one OpenFGA
model and its tuples, and enforces markings on top of role grants. The product
contract is [`../docs/product.md`](../../docs/product.md). The runbook is
[`../README.md`](../../README.md); the phase plan is
[`../impl/designs/README.md`](../../impl/designs/README.md).

Inspiration under `inspo/` is patterns, not a fork. No Lakekeeper, Archestra,
or ZenStack code is ported.

## Service laws

- Code lands only against a binding design in `impl/designs/` that
  names the phase. `impl/designs/rejected/` is never implemented.
- Fail closed. OpenFGA unreachable is `UNAVAILABLE`, never an allow. No bypass
  flag, no decision cache.
- No existence leak. A caller who cannot see an object gets the same answer as
  for a nonexistent one. Missing folder-path markings are `NOT_VISIBLE`.
- The catalog owns the tree and every display name. This service stores tuples
  only, and holds no database.
- One `index.ts` per phase. Imports point downward and only to `index.ts`. Each
  third-party library has one owning phase
  ([`layering.md`](layering.md)).
- Secrets stay in the environment. Never log tokens, `Authorization` headers,
  or claim sets. TLS is required unless `REQUIRE_TLS=false`.
- TypeScript runs under Node type stripping: `import type`, const objects
  instead of enums, no namespaces, no parameter properties, `.ts` import
  extensions ([`../docs/typescript-standards.md`](../../docs/typescript-standards.md)).

## Architecture

Eight layered phases, composed bottom-up. Phase 7 is the only surface callers
use:

| Phase | Folder | Scope |
|-------|--------|-------|
| 0 | `src/core/` | Config, `Result`/`AppError`, Fastify HTTP/2, logs, health, shutdown |
| 1 | `src/identity/` | Auth0 JWT → `Principal` |
| 2 | `src/policy-store/` | Generic OpenFGA client |
| 3 | `src/authz/` | Core model, vocabulary, role `Check` |
| 4 | `src/structure/` | Register, unregister, sync |
| 5 | `src/grants/` | Write, list, grantable |
| 6 | `src/markings/` | Categories, markings, apply/remove, marking gate |
| 7 | `src/rpc/` | Proto, Connect router, status mapping |

Status and briefs live in [`../impl/designs/README.md`](../../impl/designs/README.md), not here.

## Repository layout

| Path | Role |
|------|------|
| `factory/` | Agent kit: policy, agents, skills, templates, this profile |
| `docs/` | Product contract, TypeScript standards, decisions, glossary, review mapping |
| `src/<phase>/` | One phase each; `src/server.ts` is the composition root |
| `test/` | Contract, integration, fixtures |
| `proto/` | gRPC contract (`cosmos.authz.v1`) |
| `openfga/` | Modular model (`core.fga`, `markings.fga`) and `fga` tests |
| `impl/designs/` | Briefs (`phase-N.md`), binding designs, and task anexos; templates are `DESIGN_DOC.md` and `TICKETS.md` at the repo root |
| `impl/designs/rejected/` | Rejected designs; never implemented |
| `impl/reviews/` | Design reviews (`phase-N.md`) and reliability/security assessments |
| `impl/ideas/`, `impl/findings/` | Unbound ideas and research results |
| `inspo/` | Reference codebases (read-only) |
| `inspo/indexing/` | Agent indexes; flat `<project>-<topic>.md` notes |
| `.agents/skills/` | Canonical shared skills |
| `.claude/skills/`, `.cursor/skills/` | Symlinks to `.agents/skills/<name>` |
| `bitbucket-pipelines.yml` | CI gates |
| `docker-compose.yml` | OpenFGA for tests and local dev |

## Design research before asking

When an open design question appears, research it before asking. Do not ask the
human to decide cold.

1. Start with the indexes under `inspo/indexing/`, at its `README.md` router.
   The method is `inspo/indexing/PATTERN.md`. Sessions follow
   [`indexing.md`](../policy/indexing.md).
2. Read the official docs that a note cites, for vocabulary only.
3. Read the source paths that a note cites. On conflict with a doc, source wins.
4. Then stop and ask, per [`decisions.md`](../policy/decisions.md). State how the source
   handles it, the index verdict (adopt, adapt, or ignore), and the implication
   for this service with two or three options.

Where each topic lives:

| Topic | Notes |
|-------|-------|
| OpenFGA model, grants, check path | Lakekeeper |
| Authentication | `idp-sso.md` |
| Delegation and route gates | Archestra |
| Markings | `foundry-markings*.md` |
| Catalog kinds and parents | `cosmos-engine-*.md` |
