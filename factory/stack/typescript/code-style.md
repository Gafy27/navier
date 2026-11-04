# Code style (TypeScript on Node with type stripping)

Kit principles: `policy/rules.md`. Comments: [`comments.md`](comments.md).
Product extras (bin names, env): adopting repo `<paths.profile>/code-style.md`.

- Node runs `.ts` directly with no build step. Use `import type` for type-only
  imports, const objects instead of `enum`, no namespaces, no parameter
  properties, and `.ts` extensions in imports. No ts-node, no tsx.
- Const-object unions replace `enum` and boolean parameters. Spec values
  (status codes, limits) get a constant.
- Function names stay under 30 characters.
- No `any`. Parse untrusted input once at the boundary.
- Scripts exist only once a design adds them; check `package.json` before
  claiming a command runs.
