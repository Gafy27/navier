# TypeScript stack pack

Reusable TypeScript / Node method for the factory kit. Product laws stay in
`profile/`. Copy this folder unchanged into another TS repo.

Load when `project.language` is `typescript`.

## Adopt

1. Set `project.language: typescript` and merge [`config.yaml`](config.yaml)
   into the kit `commands:` block.
2. Set `project.stack` to include `node-backend` if the code-reviewer should
   load [`checklists/node-backend.md`](checklists/node-backend.md).
3. Point `paths.standards` at this pack's [`code-style.md`](code-style.md) or
   a project standard that extends it.
4. Rewrite `profile/` for *this* product.

Host skills (`node`, `typescript-magician`, Fastify, …) are not in this pack.
Bind them in `<paths.profile>/skills.md`.

## Files

| Path | Holds |
|------|-------|
| [`code-style.md`](code-style.md) | Node type-stripping, no `enum`, `.ts` imports |
| [`skills.md`](skills.md) | Language-skill loading and host bindings |
| [`comments.md`](comments.md) | One-line `//` / `/** … */` with TS examples |
| [`tickets.md`](tickets.md) | Green-when per unit folder |
| [`testing.md`](testing.md) | `node:test`, contract tests |
| [`config.yaml`](config.yaml) | `commands.*` for npm |
| `checklists/node-backend.md` | Code-reviewer checklist |

A filled authz-api profile (OpenFGA, Fastify phases) is
[`../../examples/authz-api/`](../../examples/authz-api/). It is not this pack.
