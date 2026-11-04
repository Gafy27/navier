---
name: secure-code-writing
description: >
  Router for the five "Writing Code" skills extracted from Building Secure and
  Reliable Systems (Google/O'Reilly), Chapter 12. Load when you want the
  chapter's overall argument or don't yet know which sub-skill applies.
  Trigger: secure code, reliable code, writing code chapter, SRS book,
  security by construction, which secure-coding skill.
---

# Writing secure and reliable code (chapter router)

Chapter 12 of *Building Secure and Reliable Systems* in five loadable skills.
Load the one that matches the task; do not load all five.

## The chapter's argument in four lines

1. Developer education and code review do not scale to whole-codebase
   invariants. Frameworks, libraries, and types do.
2. Make the unsafe thing impossible to express, not merely discouraged.
3. Give the feedback at compile time; later feedback is ignored or resented.
4. Simple code is secure code. Complexity is where the bugs hide.

## Which skill

| Task at hand | Load |
|--------------|------|
| New module, job kind, RPC/worker seam; logging, authz, retries, rate limiting | [`hardened-frameworks`](../hardened-frameworks/SKILL.md) |
| Building SQL/DDL, rendering templates, handling any untrusted input | [`safe-types-untrusted-input`](../safe-types-untrusted-input/SKILL.md) |
| Introducing a safe API, deprecating an unsafe one, migrating callers | [`framework-adoption`](../framework-adoption/SKILL.md) |
| Nesting, YAGNI, TODOs, technical debt, refactoring | [`ponytail`](../ponytail/SKILL.md) when `tools.ponytail`; always [`../../policy/implementation.md`](../../policy/implementation.md) § Complexity. Last ticket: `complexity-remover` |
| Choosing types/tools, newtypes, units, sanitizers and race detection | [`strong-types-and-sanitizers`](../strong-types-and-sanitizers/SKILL.md) |

## Relation to the other skills

- [`testing-code`](../testing-code/SKILL.md) is the companion router: these five remove bug classes by construction, those five test for the rest.
- `reliability-security` assesses a **system** and writes a document. These five skills apply while **writing code** and produce none.
- `design-docs` is for binding designs. Cite a skill in a design; do not inline it.
- A language-specific style skill, if the project has one (see `<paths.profile>/skills.md`), is the day-to-day checklist; these give the security and reliability reason behind several of its rules.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `secure-code-writing` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — chapter introduction and conclusion, verbatim.
