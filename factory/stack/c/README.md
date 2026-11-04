# C / Basilisk stack pack

Reusable method for Basilisk solvers (qcc) and the plain C that sits beside
them. Product facts (case names, YAML schema, which header owns embed vs
fraction) stay in the adopting repo's `profile/`.

Load when `project.language` is `c`.

## Adopt

1. Set `project.language: c` and `project.stack: [basilisk]`.
2. Merge [`config.yaml`](config.yaml) into the kit `commands:` block, then
   replace the command values with this repo's Make targets.
3. Point `paths.standards` at [`code-style.md`](code-style.md), or at a
   project standard that extends it.
4. Rewrite `profile/` for *this* product. Do not put case names in this pack.
5. Run `python3 factory/cli.py install`. That links `skills/basilisk` and copies
   [`../../loaders/basilisk.md`](../../loaders/basilisk.md).

## Files

| Path | Holds |
|------|-------|
| [`code-style.md`](code-style.md) | qcc vs `cc`, fields, events, includes |
| [`comments.md`](comments.md) | One-line `//` with C examples |
| [`implementation.md`](implementation.md) | Which skill to load |
| [`skills.md`](skills.md) | Skill bindings |
| [`tickets.md`](tickets.md) | Green-when fences |
| [`testing.md`](testing.md) | `cc` unit tests vs `qcc` solver tests |
| [`config.yaml`](config.yaml) | `commands.*` to merge |
| [`checklists/basilisk.md`](checklists/basilisk.md) | Code-reviewer checklist |
| [`rules/basilisk.mdc`](rules/basilisk.mdc) | Kit-relative pointer (host copy is the loader) |
| `skills/basilisk/` | Solver rules. Open `SKILL.md`, then one `rules/<id>.md` |

## Do not put here

Case folder layout, `WTConfig` fields, generator version, Basilisk install
path, which `CASE=` is the smoke case. Those belong in `profile/`.
