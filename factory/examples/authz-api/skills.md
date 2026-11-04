# Skill bindings (this project)

Maps the kit's generic skills to this repo's stack. A skill's `## Project bindings`
points at its section here. A skill with no section is used as written.

## Stack skills (not in `skills/`; loaded from the host's skill roots)

Resolved through `tools.skill_roots` in [`../config.yaml`](../config.yaml). Load only the
one the change touches.

| Skill | Use when |
|-------|----------|
| `fastify-best-practices` | Server, plugin, route, hook, schema, error-handler work. Read `SKILL.md`, then only the matching `rules/*.md` |
| `node` | Runtime, package scripts, imports, type stripping, shutdown, `tsconfig` |
| `typescript-magician` | A type error, a generic, a brand, an `any` |
| `openfga` | `openfga/*.fga`, `.fga.yaml` tests, SDK calls |

## Complexity (was `code-simplicity`)

Early return over nesting. `paths.repo_rules` already forbids speculative flexibility.
Verify with `commands.test_scope` before and after a refactor: same tests, same results,
no behavior edits in the diff. Note unrelated dead code; do not delete it in the same
change.

## safe-types-untrusted-input, strong-types-and-sanitizers

Untrusted input here: JWTs, proto requests, environment, OpenFGA responses. Each is
parsed once at the boundary into a branded or schema-derived type (TypeBox; branded ids
whose only cast sits in their parse function). No `any`; no cast outside a brand
constructor.

## hardened-frameworks

Retries, timeouts, and interceptor layout on the request path. The server is Fastify on
HTTP/2; the RPC layer is ConnectRPC (Phase 7).

## ticket-testing

How tests are written on a ticket SESSION. Load before the matching `testing-code`
child. Commands stay on Green when (`commands.*`). Do not add fuzz or sanitizer
jobs a design did not name.

## unit-testing, integration-testing, testing-code

Test rules and fixtures: [`testing.md`](testing.md). Commands: `commands.test_scope`,
`commands.setup_integration`.

## framework-adoption, static-analysis, dynamic-analysis, fuzz-testing

Lint and type gates are `commands.lint` and `commands.typecheck`. Fuzz only when a design
names it.

## deployment-*, deploying-code, verifiable-builds, binary-provenance, supply-chain-threat-model

CI is Bitbucket Pipelines (`bitbucket-pipelines.yml`), which runs the same gates as
`commands.*`. Dependency pins and the lockfile are Phase 0 decisions.

## indexing

Reference trees under `paths.reference_trees` and their `repos` slugs for the developer
index (slugs read from each tree's README or git config):

| Tree | `repos` |
|------|---------|
| `inspo/lakekeeper/` | `lakekeeper/lakekeeper` |
| `inspo/archestra/` | `archestra-ai/archestra` |
| `inspo/zenstack/` | `zenstackhq/zenstack` |

Trees with no slug listed (`cosmos_engine`, `OpenMetadata`, `supabase*`, `postgrest`,
`kysely`, `osdk-ts`) are not indexed for this service: do not open them without a reason
in the session. Finished notes to read before writing one:
`inspo/indexing/lakekeeper-request-time-check-path.md` (module) and the router
`inspo/indexing/README.md`.

`inspo/indexing/PATTERN.md` and `MODULE_TEMPLATE.md` still prescribe the retired heading
"How the inspiration codebase does it". The kit's `templates/INDEX_PATTERN.md` and
`INDEX_NOTE.md` follow what the notes actually use (What we found, Findings).
