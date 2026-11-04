# Language packs

Reusable method for one language. Copied unchanged between repos of that
language. Product facts stay in `<paths.profile>/`. Generic method stays in `policy/`.

Keep every pack in this kit even when this repo's `project.language` does
not use it. `install.py` links only the active language. Do not delete an
unused pack to "make the kit lighter."

| Pack | When |
|------|------|
| [`rust/`](rust/) | `project.language: rust` |
| [`typescript/`](typescript/) | `project.language: typescript` |
| [`c/`](c/) | `project.language: c` (Basilisk via `qcc`, plus plain C) |
| [`python/`](python/) | `project.language: python` |
| [`aws/`](aws/) | AWS skills overlay (Lambda, ECS/Fargate); not a `project.language` |

To add another language: copy `rust/` or `typescript/` as a template and replace
the gates. Every language pack provides `skills.md`: skill entrypoint paths,
required defaults (or an explicit statement that there are none), task triggers,
and loading order. Generic agents resolve it using `project.language` from
`config.yaml`; language-specific skill names belong in the pack.
Product facts stay in `<paths.profile>/`.
