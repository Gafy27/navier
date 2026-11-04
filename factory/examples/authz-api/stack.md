# Stack

Technologies the service will use, the phase allowed to import each one, and why.
None of it is installed except `@openfga/sdk`. Import ownership rules:
[`layering.md`](layering.md) §4.

| Technology | Layer / owner | Why |
|---|---|---|
| Node.js ≥ 24 with type stripping | runtime | Runs `.ts` directly with no build step. `node:test` is the test runner |
| TypeScript (`tsc --noEmit`) | tooling | Type-check only. Node runs the source |
| Fastify 5 (HTTP/2) | Phase 0 | One server, one lifecycle, Pino built in. Hosts health routes and the Connect plugin |
| Pino (through Fastify) | Phase 0 | Structured JSON logs with path redaction. No second logger |
| TypeBox (`typebox` 1.x) | shared schema language | JSON Schema that Fastify validates, with static types derived from it. Used for env and HTTP schemas (ADR-002) |
| OIDC IdP (Auth0 today) | external | Issues user and M2M JWTs. Nothing in code or config names the vendor; only the values in `IDP_*` point at it |
| `jose` | Phase 1 | JWKS fetch and JWT verify with an algorithm allowlist. No native dependencies |
| OpenFGA server (modular models) | external policy store | Named by the product contract. One store holds the model and all tuples. Modular models let Phases 3 and 6 each own a module |
| `@openfga/sdk` | Phase 2 | Official client. `package.json` holds a caret range (`^0.9.7`) and no lockfile pin yet. Speaks HTTP, not gRPC |
| `fga` CLI | tooling, Phases 3 and 6 | `fga model validate` and `fga model test` for `openfga/` |
| `@connectrpc/connect`, `@connectrpc/connect-fastify` | Phase 7 | gRPC protocol on the Phase 0 Fastify HTTP/2 server. One process, one shutdown path (confirmed, ADR-003) |
| `@bufbuild/protobuf`, `@bufbuild/protoc-gen-es`, `buf` CLI | Phase 7 | Code generation as `js+dts`, so Node does not have to strip TS enums. `buf breaking` guards the proto |
| `@connectrpc/connect-node` | tests only | gRPC client for integration tests |
| ESLint + `typescript-eslint` (type-aware) | tooling | Enforces no `any`, no floating promises, and no unsafe member access |
| Prettier | tooling | Formatting is not a review topic |
| `dependency-cruiser` | tooling | Fails CI on any import that breaks the phase rules |
| Docker Compose | tests | Runs a real OpenFGA. The SDK is never mocked |
| Bitbucket Pipelines | CI | Runs the Phase 0 gates from `bitbucket-pipelines.yml` (decision Q13) |

Nothing is pinned yet. Exact versions are pinned by the Phase 0 design. Phase 0 must confirm that the
chosen `@connectrpc/connect-fastify` major supports Fastify 5. Phase 3 must
confirm that the pinned OpenFGA and `fga` CLI versions support modular models.
