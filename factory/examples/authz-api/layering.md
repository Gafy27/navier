# Layering (phase composition)

How phases are defined, how they depend on each other, and how their public APIs
change. The phase list, briefs, and status are in
[`../impl/designs/README.md`](../../impl/designs/README.md).

## 1. A phase is an API

- A phase is one folder, `src/<phase>/`, with one public file,
  `src/<phase>/index.ts`. Everything else in the folder is private.
- Another phase imports only `../<phase>/index.ts`. Importing
  `../<phase>/anything-else.ts` reaches into internals and is a violation.
- A phase's API is made of factories, interfaces, types, and const objects.
  Consumers depend on interfaces (`PolicyStore`, `Authorizer`), not on the
  classes or closures behind them, so a fake that implements the interface can
  stand in for a test.
- A phase constructs nothing at import time. There is no module-level client,
  logger, config read, or timer. All state is created by a factory that
  `src/server.ts` calls.

## 2. Bottom-up composition

Small, generic functions compose into larger ones. The chain ends at one
abstraction that external services call:

```
loadConfig, Result, CoreServer                 (Phase 0)
  → TokenVerifier.verify                       (Phase 1)
  → PolicyStore.batchCheck / write / readAll   (Phase 2)
    → Authorizer.check / require               (Phase 3)
      → StructureService.*, GrantsService.*, MarkingsService.*, marking gate  (Phases 4, 5, 6)
        → cosmos.authz.v1.Authz/*              (Phase 7, the external contract)
```

The composition root, `src/server.ts`, is the only place where every phase is
wired together. It may import the factory and config schema of every phase's
`index.ts`. It contains no logic beyond construction, probe registration,
`listen`, and signal handling.

## 3. Lower phases are generic

| Layer | Phases | May name | Must not name |
|---|---|---|---|
| Runtime | 0 | process, HTTP, config, errors | any product noun: principal, dataset, grant, tuple, RPC method |
| Adapters | 1, 2 | one external system's concepts (JWT claims; tuples, relations, stores) | Cosmos resource types, actions, roles, gRPC |
| Domain | 3, 4, 5, 6 | Cosmos types, actions, privileges, grants, markings | wire types, status codes, `request`/`reply` |
| Surface | 7 | proto messages, Connect codes, method names | policy rules (which relation grants what) |

Test for genericity: could the phase be copied into an unrelated service that
uses the same external system without editing it? Phases 0–2 must pass that
test.

## 4. Dependencies point downward

Rules, all enforced by `npm run deps:check` (`dependency-cruiser`):

1. **Downward only.** Phase N may import Phase K only if K < N and K is in N's
   `Depends on` list.
2. **No cycles**, within a phase or across phases.
3. **No skip-level imports.** Each third-party library has exactly one owning
   phase (table below). Importing it from any other phase skips past the
   wrapper that phase provides, and is a violation. Example: `src/grants/`
   importing `@openfga/sdk` instead of using `PolicyStore`.
4. **Index only.** Cross-phase imports target `index.ts` only.
5. **Type-only for wiring types.** A phase may `import type` an interface from
   a lower phase it lists, for example to accept a `PolicyStore` argument. That
   is still a dependency and must be listed.

| Library | Owner | Others |
|---|---|---|
| `fastify` | Phase 0 | `import type` through `core/index.ts` re-exports only |
| `typebox` (1.x) | shared | every phase, for its own config and HTTP schemas |
| `jose` | Phase 1 | none |
| `@openfga/sdk` | Phase 2 | none |
| `@connectrpc/*`, `@bufbuild/protobuf` | Phase 7 | none (tests may use `@connectrpc/connect-node`) |
| `node:*` built-ins | any | `process.env` only in `src/server.ts` |

The composition root also owns the cross-phase policy maps (`METHOD_POLICY`,
`CONSISTENCY_POLICY`) and the observability hook implementation. Phases receive
them as arguments and never restate their contents.

## 5. Phase N or N+1?

Ask these in order. The first "yes" decides.

1. Does it mention a product noun (dataset, grant, organization, RPC method)?
   Then it is not in Phases 0–2.
2. Does it need the wire format or a status code? Then it belongs to Phase 7.
3. Does it combine capabilities from two lower phases? Then it belongs to the
   lowest phase that already depends on both.
4. Is it used by exactly one higher phase? Then put it in that phase. Do not
   push it down "in case".
5. Is it a rule about an external system that holds no matter what is stored?
   Then it belongs to that system's adapter (Phase 1 or 2).

Worked examples:

| Thing | Phase | Why |
|---|---|---|
| Rejecting a write over `OPENFGA_MAX_TUPLES_PER_WRITE` | 2 | Step 5: an OpenFGA limit, true for any model. The value is config |
| Rejecting a grant diff larger than one write | 5 | Step 1: a product rule (a diff is atomic). Phase 5 reads the cap from `PolicyStore.limits`; it keeps no constant of its own |
| `batchCheck` failing on a missing correlation id | 2 | Step 5: a property of the OpenFGA batch API, not of Cosmos |
| Pairing each action with a visibility check | 3 | Step 1: "visibility" is a Cosmos relation name |
| `sub` must not contain `:`, `#`, or whitespace | 1 | Step 5: the subject is IdP data, and the rule protects the principal id format |
| Object id must not contain `:` or `#` and must have a model type prefix | 3 | Step 1: the allowlist comes from the Cosmos model |
| Only service principals may call `RegisterResource` | 7 (method map) and 4 (domain rule) | Step 2 for the gate on the method map. Phase 4 repeats the check because the rule is part of its contract, not of the wire |
| `AppError` → HTTP status for `/readyz` | 0 | Phase 0 owns the HTTP routes |
| `AppError` → gRPC `Code` | 7 | Step 2 |
| ANDing markings into a role decision | 6 | Step 3: combines Phase 3 decisions with marking membership. It returns an `Authorizer`, so Phase 7 does not know markings exist |
| Deleting every tuple that names an object | 4 | Step 4: only Unregister uses it, so it is built from `readAll` and `write` in Phase 4, not added to `PolicyStore` |
| Reading the pinned model as `ModelView` | 2 | Step 5: generic OpenFGA call |
| Deriving `can_*` actions from `ModelView` | 3 | Step 1: `can_*` is a Cosmos naming convention |

## 6. Versioning and documentation

- **Version.** Each design header carries `Public API: vMAJOR.MINOR` for
  `index.ts`. A new export, or a new optional input field, is a minor change.
  Any of these is a major change: a removed or renamed export; a changed
  signature; a new member in an exported union, such as an error code (it
  breaks exhaustive `switch`es); or a changed documented behavior.
- **Process.** A major change requires a design revision, a review entry in
  `impl/reviews/phase-N.md`, and an update to every consumer in the same
  change. There is one repo, so there are no parallel versions and no
  deprecation window.
- **Documentation.** The design's `APIs` section is normative. Every export in
  `index.ts` has TSDoc stating its contract, its error codes, and its side
  effects. The phase brief is input only; once a design is binding, the design wins and
  the brief is not updated.
- **Enforcement.** `test/contract/<phase>.test.ts` imports only `index.ts` and
  pins each export's documented behavior. A behavior change that does not break
  a contract test was not documented.
- **External contract.** `proto/authz/v1/authz.proto` is versioned by package.
  `buf breaking` against the main branch runs in CI. A breaking proto change
  needs `cosmos.authz.v2`.
