---
name: factory-router
description: >
  Route a coding task to one task row, its named dependencies, and one agent. Use when the work
  is research, design, tickets, implementation, review, tests, comments, or a
  reliability assessment. Do not load every policy file.
---

# Factory router

Start here after the repo `AGENTS.md`. Select the row that matches the task and load its named dependencies only.
Every `paths.*`, `commands.*`, `vocabulary.*`, and `tools.*` key is in `factory/config.yaml`.
Never copy a value out of it into a doc or a prompt.

Resolve `paths.profile` and read `<paths.profile>/README.md` before the selected
row's project documents. `<paths.profile>/...` means a path under that configured
directory, resolved from the repository root; see `policy/rules.md` § Profile
documents. Do not substitute the kit's default profile when a configured one
is missing.

Hard stops and the order of authority are in the repo `AGENTS.md`. **Every
agent:** read skill `caveman` at **full** ([`policy/rules.md`](../../policy/rules.md) §
Caveman). Any `*_TICKETS.md` SESSION: read [`policy/tickets.md`](../../policy/tickets.md) §
Token discipline before acting.

## Task router

| Task | Read | Agent | Skills |
|------|------|-------|--------|
| Research a codebase or docs into an index note | [`policy/indexing.md`](../../policy/indexing.md), [`policy/markdown.md`](../../policy/markdown.md), [`policy/reading.md`](../../policy/reading.md), `paths.index_pattern`; [`policy/rea.md`](../../policy/rea.md) when the session uses REA | `research` | `indexing`, `rea` (when `tools.rea`) |
| Design a unit, API, or model change | [`policy/design.md`](../../policy/design.md), [`policy/decisions.md`](../../policy/decisions.md), [`policy/reading.md`](../../policy/reading.md), `paths.design_template` then `paths.program_template` — **must read** `design-docs` then `modular-design` | `designer` (one pass per session: architecture, program, anexo) | `design-docs`, `modular-design`, `explaining-design-problems` |
| Open a phase, or add or update a phase README row | [`policy/phases.md`](../../policy/phases.md), `paths.phase_readme_template` | parent | — |
| Ask the human to choose between designs | [`policy/decisions.md`](../../policy/decisions.md) | parent | — |
| Review a design or, on request, its tickets anexo | [`policy/review.md`](../../policy/review.md), [`policy/reading.md`](../../policy/reading.md) — **must read** `design-docs` then `modular-design`. Parent names kind: `architecture` \| `program` \| `anexo` | `spec-reviewer` (fresh session) | `design-docs`, `modular-design` |
| Run a `*_TICKETS.md` anexo | [`policy/tickets.md`](../../policy/tickets.md) § Token discipline + full file | parent runs `ticket-orchestrator` | `ticket-orchestrator` |
| How does this existing slice work? | [`policy/graphify.md`](../../policy/graphify.md), [`policy/reading.md`](../../policy/reading.md) | parent | `graphify` (when enabled) |
| Implement one ticket or a change | [`policy/tickets.md`](../../policy/tickets.md) § Token discipline, [`policy/implementation.md`](../../policy/implementation.md) — **must read** § Secure code and naming | `implementer` | **always** `ponytail` `full` + `caveman` `full` (Read SKILL bodies); then `secure-code-writing`, `safe-types-untrusted-input`, `strong-types-and-sanitizers`, `naming`, `ticket-testing`, `testing-code` + stack skills in `<paths.profile>/skills.md` and `stack/<language>/skills.md` |
| Last ticket of an anexo (remove complexity) | [`policy/tickets.md`](../../policy/tickets.md) | `complexity-remover` (spawned by `ticket-orchestrator`) | `ponytail` `ultra`, `ponytail-review` hunt, `modular-design`, `naming`; method in the agent's instructions |
| Ticket claims green | [`policy/tickets.md`](../../policy/tickets.md) § Review level | auto-spawns for `tools.review` (`flexible` / `normal` / `full`) | — |
| Review this diff (explicit) | [`policy/implementation.md`](../../policy/implementation.md) — **must read** § Secure code and naming | `code-reviewer`; add `security-reviewer` / `silent-failure-hunter` when the human asks or when `full` and the diff matches | `secure-code-writing`, `ponytail-review` (when `tools.ponytail`), `safe-types-untrusted-input`, `strong-types-and-sanitizers`, `naming`, § Complexity |
| Write or review tests | [`policy/testing.md`](../../policy/testing.md), `<paths.profile>/testing.md`, plus `stack/<language>/testing.md` | `implementer` | `testing-code`, `unit-testing`, `integration-testing` |
| Trim or write comments | [`policy/comments.md`](../../policy/comments.md), plus `stack/<language>/comments.md` | any | — |
| Assess reliability or security of a system | [`policy/reliability.md`](../../policy/reliability.md) | parent | `reliability-security` |
| Change a layer boundary or a public API | `<paths.profile>/layering.md` | `designer` | `design-docs`, `modular-design` |
| Explain a design problem without proposing a fix | `skills/explaining-design-problems/SKILL.md` | parent | `explaining-design-problems` |
| Recall or save project memory (when `tools.memory`) | [`policy/memory.md`](../../policy/memory.md) | any | `agent-memory` |

Agent roles and dispatch law: [`policy/agents.md`](../../policy/agents.md). Language-pack
agents: `stack/<project.language>/agents.md`. Extra agents this project's host provides:
`<paths.profile>/agents.md`.

## Skills by theme

Each skill's `SKILL.md` is its entrypoint. Supporting references, rules, and scripts
are optional; load only resources named by that entrypoint for the current task.
Load only what the change touches. Project bindings for each are in `<paths.profile>/skills.md`.

| Theme | Skills |
|-------|--------|
| Write | `secure-code-writing` → `ponytail` `full` (when `tools.ponytail`; last ticket `ultra`) or `implementation.md` § Complexity, `safe-types-untrusted-input`, `strong-types-and-sanitizers`, `hardened-frameworks`, `framework-adoption`; `naming` |
| Rust (when `project.language` is `rust`) | `rust-skills` → `rust-patterns`, `rust-best-practices`, `rust-async-patterns`, `fast-tokio` — pack [`stack/rust/`](../../stack/rust/) |
| TypeScript (when `project.language` is `typescript`) | pack [`stack/typescript/`](../../stack/typescript/); host skills in `<paths.profile>/skills.md` |
| C / Basilisk (when `project.language` is `c`) | `basilisk` — pack [`stack/c/`](../../stack/c/); open `SKILL.md`, then one `rules/<id>.md` |
| Test | `ticket-testing` (tickets), then `testing-code` → `unit-testing`, `integration-testing`, `fuzz-testing`, `static-analysis`, `dynamic-analysis` |
| Ship | `deploying-code` → `deployment-best-practices`, `deployment-enforcement`, `verifiable-builds`, `binary-provenance`, `supply-chain-threat-model` |
| Document and plan | `design-docs`, `modular-design`, `explaining-design-problems`, `reliability-security`, `indexing`, `ticket-orchestrator` |
| Code graph (when `tools.graphify`) | `graphify` |
| Memory (when `tools.memory`) | `agent-memory` |
| Live web (when `tools.firecrawl`) | `firecrawl` → command skills in `skills/firecrawl-*` (developer-index, scrape, search, map, workflows, …) |
| Write agents (when `tools.ponytail`) | `ponytail` `full` on `implementer` / `rust-senior-developer`; `ultra` on `complexity-remover`; `ponytail-review` on `code-reviewer` (and hunt on last ticket) — law [`policy/ponytail.md`](../../policy/ponytail.md) |
| Chat tone / fat CLI | **Always read** `caveman` at **full**; apply law [`policy/caveman.md`](../../policy/caveman.md) when `tools.caveman` — [`rules.md`](../../policy/rules.md) § Caveman |
| Reverse engineering (when `tools.rea`) | `rea` — closed web apps, shipped binaries, HAR captures; law [`policy/rea.md`](../../policy/rea.md) |

Firecrawl skills are installed only when `tools.firecrawl` is true.
Graphify is installed only when `tools.graphify` is true.
REA is installed only when `tools.rea` is true.
Ponytail is installed only when `tools.ponytail` is true.
Caveman skill links install when `tools.caveman` is true; agents still **read**
`factory/skills/caveman/SKILL.md` from the kit when the flag is false.
Agent memory is installed only when `tools.memory` is true.
Ticket auto-reviews follow `tools.review` (`flexible` \| `normal` \| `full`;
missing is `normal`). A chat can override for the session
(`policy/tickets.md` § Review level). `python3 factory/cli.py install` is what
links them.
