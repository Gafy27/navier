# Factory profile setup for this repository

Adapt Factory to this selected repository.

- Selected project root: `{{PROJECT_ROOT}}`
- Factory kit and portable profile templates: `{{FACTORY_ROOT}}`

Read the repository contract and existing instructions, Factory's router and config, and the portable profile templates. Inspect relevant source, build manifests, tests, and launch harnesses. Preserve unrelated work and all existing filled profile choices. Do not ingest the whole source tree recursively.

Fill `README.md`, `requirements.md`, `layering.md`, `stack.md`, `code-style.md`, `testing.md`, `skills.md`, `tickets.md`, and `agents.md` in the configured profile location (`paths.profile`; default `factory/profile`). Keep generic method in `policy/`, language rules in `stack/`, product facts in the custom profile, and paths/commands in config. Use evidence from the selected repository.

Discover commands and tools from repository evidence. Ask only about genuine product, security, preference, or inaccessible facts. Do not guess commands, build integration stacks, copy Cosmos Engine or Basilisk laws, expose secrets, or weaken gates.

Fill `<profile>/testing.md` directly (use `{{FACTORY_ROOT}}/profile/example/testing.md` as a portable starting point). Include **Test selection**, **Launch**, **Doctor**, **Drive**, **Evidence**, and **Cleanup** sections. Define bounded feature recipes only from existing executable harnesses. Link the existing generic test skills. This document owns project testing recipes; do not create or register a separate project testing skill.

Testing policy in the document must require ticket scoped tests plus an affected behavior journey when an observable runtime behavior changes; a bug reproduction before and after a fix; relevant journeys at subphase close; selected or full suites on demand; and exercise of any changed verification recipe. Docs-only work needs no runtime journey. Use live dependencies only when explicitly required by Green-when, with private generated fixtures; never use production or shared data. An unavailable required check is blocked/unverified, never a pass.

Execute one available journey before claiming a recipe is verified. Preserve evidence after cleanup. If execution is impossible, state the prerequisite and exact unverified scope. Factory installation checks structure; it does not prove the application works.

Run `python3 "{{FACTORY_ROOT}}/cli.py" check --root "{{PROJECT_ROOT}}"`; fix configuration gaps within scope and rerun it. Report changed files, command receipts, evidence, and unresolved gates. Do not automatically spawn agents, install host plugins or dependencies, start services, change secrets, or fetch remote material. The user will decide when to install Factory and will take this prompt to their own agent.
