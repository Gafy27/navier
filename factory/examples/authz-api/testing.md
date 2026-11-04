# Testing (this project)

Binds [`../policy/testing.md`](../policy/testing.md) to authz-api. Test kinds and
locations: `paths.standards` §10.

- Runner: `node:test`. Gates and scoped command are `commands.*` in
  [`../config.yaml`](../config.yaml).
- Integration needs a real OpenFGA (`commands.setup_integration`). Real OpenFGA, the JWT
  verifier, and the wire are the only integration targets; everything else is unit.
- Never mock Fastify or `@openfga/sdk`. A local fake HTTP server only where a design
  names it.
- No test calls the identity provider. Tests sign their own JWTs and serve a JWKS from
  `test/fixtures/`.
- Contract tests live at `test/contract/<phase>.test.ts` and import only
  `src/<phase>/index.ts`.
