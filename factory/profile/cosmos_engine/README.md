# Project profile

A profile adapts Factory's reusable agents to one project. It tells agents
what the product does, which boundaries they must respect, which project
skills apply, and how to verify their work. It records project facts and
points to their owners; it does not replace the product contract or a binding
design. Follow the repository's authority order when sources disagree.

This directory is the active **Cosmos Engine** profile. Portable examples live
in [`example/`](example/); they are setup material, not this project's laws.

## How agents load a profile

Read `paths.profile` from the kit's `config.yaml`. A relative value is resolved
from the repository root; an absolute value stays absolute. The default is
`factory/profile`, but each project can configure another directory.

Read that directory's `README.md` first, then only the documents required by
the task and the agent's role. `<paths.profile>/...` in Factory instructions
means a path under this configured directory. Do not substitute a different
profile when a required file is missing; report the setup gap.

Before selecting or running project tests, read `testing.md` in the active
profile. It contains the project recipes directly; no separate project
testing skill or skill registration is required.
See [`testing policy`](../policy/testing.md) for review and validation roles.

## What belongs here

Keep product-specific facts here. Reusable agent workflow belongs in
[`policy/`](../policy/); language rules and bundled language skills belong in
[`stack/`](../stack/). Concrete paths, commands, vocabulary, and tool switches
belong in [`config.yaml`](../config.yaml). Profile documents refer to those
config keys instead of maintaining another copy of their values.

For example, a profile names which unit owns a database client and which
existing test journey proves a product behavior. The language pack owns
language idioms; the generic testing policy owns the test-writing method.

| File | Holds |
|------|-------|
| `README.md` | Profile purpose, project identity, and document routing |
| [`requirements.md`](requirements.md) | Objective, engine laws, architecture, phases |
| [`layering.md`](layering.md) | Crate boundaries, import direction |
| [`stack.md`](stack.md) | Technologies and which crate owns each |
| [`code-style.md`](code-style.md) | Pointers to the Rust pack + this repo's extras |
| [`testing.md`](testing.md) | Test selection, prerequisites, behavior journeys, evidence, cleanup |
| [`skills.md`](skills.md) | Skill bindings for this engine |
| [`tickets.md`](tickets.md) | Ticket scope and pointers to project behavior journeys |
| [`agents.md`](agents.md) | Available project-specific agents and when to use them |

Optional `agent-overlays/<agent>.md` files add project-specific instructions
to an installed Factory agent. Keep reusable role behavior in `agents/` in
the kit; overlays must respect the repository's authority and role limits.

## Create a profile for another project

1. Read the target repository's product contract, existing agent instructions,
   manifests, relevant source, tests, and launch harnesses. Establish facts
   from that repository; do not carry over Cosmos Engine's laws or commands.
2. Choose the active directory and set `paths.profile` in `config.yaml`.
   Use [`example/`](example/) as the starting structure for the nine Markdown
   documents above. Adapt its sample names and content to the target project,
   remove setup placeholder markers, and make the new README identify the
   project and route agents to its documents. Preserve existing project
   decisions when updating a profile; do not overwrite filled files blindly.
3. Set `project.language` to the language pack and `project.stack` to applicable
   review checklists. Fill paths and commands from repository evidence. An
   unavailable command stays empty; report required missing capabilities
   rather than inventing scripts. Map additional project skills in `skills.md`.
4. Fill `testing.md` using the portable [testing example](example/testing.md).
   Include Test selection, Launch, Doctor, Drive, Evidence, and Cleanup
   sections. Describe existing executable harnesses and their limits; keep
   generic testing methods in Factory's testing skills and policy.
5. Repair relative links for the selected profile location. Check that named
   units, skills, commands, and harnesses exist. Ask the owner about unresolved
   product or security choices; do not turn an assumption into project law.
6. Run `python3 factory/cli.py check --root .` from the target repository.
   Fix structural gaps, then run `python3 factory/cli.py install --root .`
   when installation is authorized. The installer generates host instructions,
   and appends configured agent overlays.
7. Run an available, authorized behavior journey before claiming its recipe
   verified. Record the command, outcome, evidence, and limits. Structural
   setup checks and installation do not prove that the product works.

For a guided handoff, run
`python3 factory/cli.py setup --root . --output factory-profile-prompt.md`.
It produces a repository-specific prompt for the agent doing the setup.
The full adoption workflow is in the [Factory README](../README.md#adopt-in-another-repo).

This project's language rules are in the [Rust pack](../stack/rust/).
Other filled profiles, such as [authz-api](../examples/authz-api/), illustrate
the structure; their product choices do not apply here.
