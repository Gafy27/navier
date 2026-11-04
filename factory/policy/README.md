# Policy

How agents work, independent of language and framework. **First action** every
session: read the repo `AGENTS.md` (`paths.repo_rules`), then the one row in
[`../skills/factory-router/SKILL.md`](../skills/factory-router/SKILL.md) that
matches the work, then that row's file in this folder. Language method lives
in [`../stack/<language>/`](../stack/) when that folder exists. Project-specific
facts live in [`../config.yaml`](../config.yaml) and `<paths.profile>`,
never here.

When a rule changes, edit this folder first, then the repo rules file
(`paths.repo_rules`) if its summary is affected. Do not keep a second copy of a rule
in chat or in an agent file; link it.

## Always

1. [`rules.md`](rules.md) — tone (pointer to [`caveman.md`](caveman.md) when `tools.caveman`), workflow, code-style principles, gates.
2. [`reading.md`](reading.md) — search then sliced Read; no full long specs.
3. [`graphify.md`](graphify.md) — before Read / Grep / Glob of code (if `tools.graphify`); skill `graphify`.
4. [`firecrawl.md`](firecrawl.md) — any live-web, library, or paper lookup (if `tools.firecrawl`); skills `factory/skills/firecrawl*`.
5. [`rea.md`](rea.md) — reverse-engineering evidence from closed web apps, binaries, or captures (if `tools.rea`); skill `factory/skills/rea`.
6. [`ponytail.md`](ponytail.md) — write: `ponytail` `full`; last ticket: `ultra` + hunt; `code-reviewer`: `ponytail-review` (if `tools.ponytail`). Leftover complexity laws: [`implementation.md`](implementation.md) § Complexity.
7. [`caveman.md`](caveman.md) — chat speech + fat-CLI shrink (if `tools.caveman`); skill `factory/skills/caveman`. Ponytail still owns code.
8. [`agents.md`](agents.md) — dispatch named agents by task; reviewer after designer.
9. [`memory.md`](memory.md) — read and update the shared memory repo (if `tools.memory`); skill `agent-memory`.

## Then open one

| If you are… | Read |
|-------------|------|
| Designing a unit, API, or model change | [`design.md`](design.md), [`decisions.md`](decisions.md), then [`agents.md`](agents.md) (architecture, then program, then anexo) |
| Opening a phase or editing a phase README | [`phases.md`](phases.md) |
| Reviewing a design or ticket anexo | [`review.md`](review.md) |
| Chat tone / fat CLI dumps | [`caveman.md`](caveman.md) |
| Live-web / library / paper lookup | [`firecrawl.md`](firecrawl.md) |
| Closed web app, shipped binary, or HAR capture | [`rea.md`](rea.md) |
| Writing or running tickets | [`tickets.md`](tickets.md), then [`testing.md`](testing.md); then `stack/<project.language>/tickets.md` |
| Writing, reviewing, or refactoring code | [`implementation.md`](implementation.md), then [`testing.md`](testing.md); then `stack/<project.language>/implementation.md` when that file exists |
| Writing tests only | [`testing.md`](testing.md) |
| Writing or trimming comments | [`comments.md`](comments.md) |
| Indexing a reference codebase | [`indexing.md`](indexing.md) |
| Assessing reliability or security of a system | [`reliability.md`](reliability.md) |
| Dispatching or reviewing via named agents | [`agents.md`](agents.md) |

Do not load every file.

## Enforcement coverage

[`enforcement.md`](enforcement.md) maps policy rules to hooks, lint, tests,
or prose-only review, including invocation and coverage gaps. Consult it
when changing a rule or investigating a repeated violation; it is not
startup reading and adds no policy authority.

The [workflow pilot](../evals/workflows/README.md) records small comparisons
when instruction changes need evidence. It is not a routine task gate.

## Where things live

| Kind | Home |
|------|------|
| Generic method (this folder, `agents/`, `skills/`, `templates/`) | Copied unchanged between projects |
| Language pack (cargo, rust-skills, qcc/Basilisk, Node type-stripping) | [`../stack/<language>/`](../stack/) when `project.language` matches |
| Paths, commands, vocabulary, tool switches | [`../config.yaml`](../config.yaml) |
| Laws, layout, stack, import boundaries, skill bindings of this project | [`../profile/`](../profile/) |
| Model per agent | `agents/<name>/agent.yaml` |
| Agent memory of this project | `paths.memory`, its own git repo; never copied between projects |
