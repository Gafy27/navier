# Skill bindings (C / Basilisk)

Product bindings (which header owns the body, which Make target is the
gate) stay in the adopting repo's `<paths.profile>/skills.md`.

Skill directories below are relative to this pack's `skills/`; open their
`SKILL.md` entrypoints. When writing, reviewing, or refactoring C in this pack,
start with `basilisk`, then only the `rules/<id>.md` the change needs. Also read
[`implementation.md`](implementation.md). Solver files go through `qcc`, not `cc`.

| Skill | Use when |
|-------|----------|
| `basilisk/` | Any `.c` / `.h` that includes a Basilisk header, or a test that must not |
| `latex-docs/` | Editing or creating a `.tex` file, or building its PDF |
| `ticket-testing` | Ticket SESSION — kit skill, then [`testing.md`](testing.md) |

`secure-code-writing`, Ponytail (when `tools.ponytail`), and the testing-code children stay
in the kit `skills/` folder, not this pack.
