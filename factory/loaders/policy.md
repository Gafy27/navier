---
description: Load kit method from factory/. Source of truth for agent behavior.
alwaysApply: true
---

# Policy

**First action:** read [`AGENTS.md`](../../AGENTS.md), then **read**
[`factory/skills/caveman/SKILL.md`](../../factory/skills/caveman/SKILL.md) at
**full** ([`factory/policy/rules.md`](../../factory/policy/rules.md) § Caveman).
Any `*_TICKETS.md` SESSION:
read [`factory/policy/tickets.md`](../../factory/policy/tickets.md) § Token discipline
([`factory/policy/rules.md`](../../factory/policy/rules.md) § Token discipline).
Then the one row in
[`factory/skills/factory-router/SKILL.md`](../../factory/skills/factory-router/SKILL.md)
that matches the work, then only that row's file in
[`factory/policy/`](../../factory/policy/).

That kit is the source of truth. Host `CLAUDE.md` and `AGENTS.md` are
pointers. Edit `factory/policy/` (method), `factory/stack/<language>/`
(language), and `<paths.profile>/` (this product). Generic stubs:
`factory/profile/example/`. Do not keep a second
copy of a rule in this file.

Resolve `paths.profile` from `factory/config.yaml` relative to the repository
root. Read `<paths.profile>/README.md`, then only the task's profile documents
(`factory/policy/rules.md` § Profile documents).

Always: if `tools.graphify` in `factory/config.yaml`, graphify before
exploring code. If `tools.firecrawl`, live-web and library lookup through
Firecrawl. Speech when `tools.caveman`: [`factory/policy/caveman.md`](../../factory/policy/caveman.md)
(after reading the skill; [`rules.md`](../../factory/policy/rules.md) § Caveman).
Tone: [`factory/policy/rules.md`](../../factory/policy/rules.md).
Product laws: `<paths.profile>/requirements.md`.

Named agents live in `.agents/agents/` (host `agents/` dirs are
symlinks). If the user's ask matches one, spawn it
([`factory/policy/agents.md`](../../factory/policy/agents.md)). After a
architecture/program design session, spawn `spec-reviewer` before BINDING.
Review a tickets anexo only on request; it needs no review verdict to run.

During design: research, then stop on important decisions
([`factory/policy/decisions.md`](../../factory/policy/decisions.md)). Do
not lock a `D` silently.
