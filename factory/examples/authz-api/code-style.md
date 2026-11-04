# Code style (TypeScript on Node with type stripping)

Language-specific rules for this project. The language-neutral principles are in
[`../policy/rules.md`](../policy/rules.md); the full standard is `paths.standards`
in [`../config.yaml`](../config.yaml).

- Node runs `.ts` directly with no build step. Use `import type` for type-only
  imports, const objects instead of `enum`, no namespaces, no parameter properties,
  and `.ts` extensions in imports. No ts-node, no tsx.
- Const-object unions replace `enum` and boolean parameters. Spec values (HTTP 200,
  the tuple cap) get a constant.
- Function names stay under 30 characters.
- No `any`. Parse untrusted input once at the boundary.
- Run locally: `REQUIRE_TLS=false node src/server.ts` with the env in
  `paths.product_contract` (§ Configuration).
- Scripts exist only once a phase adds them; check
  `package.json` before claiming a command runs.
