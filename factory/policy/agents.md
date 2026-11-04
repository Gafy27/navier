# Agents

**Caveman:** every agent reads [`../skills/caveman/SKILL.md`](../skills/caveman/SKILL.md)
at **full** each session ([`rules.md`](rules.md) § Caveman).

**Token discipline:** any agent working on a `*_TICKETS.md` SESSION must read
[`tickets.md`](tickets.md) § Token discipline before acting (also
[`rules.md`](rules.md) § Token discipline). No pre-edit gate sweeps on serial
ticket N > 1.

How this repo uses named agents. Files live in `.agents/agents/`.
Claude Code loads `.claude/agents` and Cursor loads `.cursor/agents`
(both symlink here). The parent chat is a dispatcher. It does not
impersonate a named agent. Host-specific agents beyond the map below:
`<paths.profile>/agents.md`.

**Mechanism.** Spawn with the Task tool. `subagent_type` is the agent
`name:` in `.agents/agents/<name>.md`. Read that file before launching.
Pass a self-contained prompt (the subagent has no parent history).

**Fallback when no Task tool is exposed.** Launch a fresh headless
Claude Code process from Bash. It has no parent history, so it is still
independent:

```bash
claude -p --agent <name> \
  --disallowedTools "Edit Write NotebookEdit" \
  --allowedTools "Read Grep Glob Bash(graphify:*) Bash(grep:*) Bash(rg:*) Bash(sed:*) Bash(cat:*) Bash(head:*) Bash(tail:*) Bash(wc:*) Bash(ls:*) Bash(awk:*)" \
  < <prompt-file> > <output-file>
```

- `--agent <name>` loads `.agents/agents/<name>.md` through `.claude/agents`.
- Write the prompt to a file first, so it is self-contained and kept: the
  spec path, the companion clauses, the locks, what to hunt for, and the
  agent's required output format.
- Reviewers (`spec-reviewer`, `code-reviewer`, `security-reviewer`, …)
  get edit tools disallowed and only read-only Bash plus `graphify`. A
  designer or implementer gets only the tools its agent file lists.
- Run it with `run_in_background`. Write the output to a repo-local
  path that survives the session (for example `.firecrawl/` or a
  gitignored `tmp/`), not a session scratchpad.
- One process per review round. Never resume a reviewer as a designer.
- Say in the reply that the fallback was used. It runs on the user's
  account and quota, and its limits come from `--allowedTools` rather
  than harness permission prompts.

If the user's ask matches an agent description below, spawn that agent.
Do not do its job in the parent.

## Map

Kit files: [`../agents/<name>/`](../agents/) (`agent.yaml` + `instructions.md`).
`python3 factory/cli.py install` renders each one to `.agents/agents/<name>.md`.
Do not keep a second prompt in the host file.

| User asks… | Spawn |
|------------|--------|
| Design a unit, API, or model change (architecture, then program landing, then anexo) | `designer` (one pass per session) |
| How does this existing slice work? | parent (`graphify`, then cited paths) |
| Architecture or program spec just written or amended | `spec-reviewer` — **mandatory**; parent names the kind |
| Review a tickets anexo (explicit ask) | `spec-reviewer` — optional; kind `anexo` |
| Ticket claims green | auto-spawns follow `tools.review` ([`tickets.md`](tickets.md) § Review level) |
| Review this diff / code just landed (explicit ask) | `code-reviewer` |
| Code handles untrusted input, auth, wire, secrets | `security-reviewer` |
| I/O, errors, fallbacks, swallowed failures | `silent-failure-hunter` |
| Run a `*_TICKETS.md` anexo | parent is `ticket-orchestrator` |
| Last ticket of an anexo (remove complexity) | `complexity-remover` |
| Index / research a tree into notes | parent follows [`indexing.md`](indexing.md); one SESSION per chat |

Language-pack rows (`rust-senior-developer`, …): `stack/<project.language>/agents.md`.
Host extras: `<paths.profile>/agents.md`.

Ticket implementers: `implementer` (`ponytail` `full`) for tickets 1..N−1 and
`complexity-remover` (`ponytail` `ultra`) for the last ticket (fresh Task, no
`resume`, no private agent memory). Every agent, implementer included, reads and writes the shared memory
repo per [`memory.md`](memory.md).
Do not spawn `rust-senior-developer` or `generalPurpose` for a ticket.
One fresh Task per SESSION.

## Design then review (mandatory)

A designer is done when **this pass's** file exists or changed. For an
architecture or program spec, **then spawn `spec-reviewer`** for that artifact.
Do not skip because the parent "already checked." Anexo review runs only on
request and is not required before execution. Loop:

[`design.md`](design.md) three passes. Architecture BINDING, then program
BINDING, then anexo, then tickets. Review the anexo only on request.

```
research
        │
        ▼
  architecture gate (policy/decisions.md)  — wait for your picks
        │
        ▼
  architecture spec on disk
        │
        ▼
  spec-reviewer (architecture)
        │
        ├── VERDICT ready        → ask "mark architecture BINDING?"
        └── fix-then-ready / not-ready → designer fixes → review again
        │
        ▼
  program-design gate  — PD picks only
        │
        ▼
  program spec on disk
        │
        ▼
  spec-reviewer (program)
        │
        ├── VERDICT ready        → ask "mark program BINDING?"
        └── fix → review again
        │
        ▼
  anexo on disk
        │
        ▼
  tickets may run  — anexo review optional, on request
```

Do **not** mark BINDING on your own. An agent may record explicit human
approval under [`design.md`](design.md#user-authorized-binding-status), without
asking for that approval again. Do **not** write the anexo before program BINDING.
Do **not** run tickets. Do **not** start product code.
Until the program sibling is BINDING (or grandfathered: [`design.md`](design.md))
and the anexo satisfies the execution prerequisites in `tickets.md`.

`spec-reviewer` never edits. The designer applies the findings. Name the
artifact in the reviewer prompt.

## After implementation

| Just finished | Spawn |
|---------------|--------|
| One ticket SESSION | auto-spawns in [`tickets.md`](tickets.md) § Review level (`flexible` / `normal` / `full`) |
| Explicit "review this" | `code-reviewer` (any level) |
| Untrusted input / proto / auth / wire | `security-reviewer` when `full`, or when the human asks |
| Error paths / I/O | `silent-failure-hunter` when `full`, or when the human asks |

Reviewers report. The parent (or a new implementer Task) applies fixes.
Do not treat the implementer as the reviewer.

## Parent must not

- Write `tools.review` into `config.yaml` because a chat named a level
- Write product code while orchestrating tickets
- Pick a design gate without asking (`policy/decisions.md`)
- Promote a spec to BINDING without explicit human approval and the review
  prerequisite in [`design.md`](design.md#user-authorized-binding-status)
- Write or run tickets before the program sibling is BINDING (unless grandfathered in [`design.md`](design.md))
- Spawn `rust-senior-developer`, `generalPurpose`, or any agent with private memory as a ticket worker (see `stack/<language>/agents.md`)
- Spawn a subagent without [`memory.md`](memory.md) in its prompt when `tools.memory`
- Resume a designer as a reviewer, or a reviewer as a designer
- Paste two indexing SESSION blocks into one chat
- Explore source without graphify (`policy/graphify.md`) when `tools.graphify`
- Open long specs or source trees without sliced Read (`policy/reading.md`)
- Live-web lookup without Firecrawl (`policy/firecrawl.md`) when `tools.firecrawl`
