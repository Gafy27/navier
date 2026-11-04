---
name: ticket-orchestrator
description: >
  Run a binding-design tickets anexo by spawning one fresh subagent per SESSION
  block. The parent does not write code and does not continue a ticket chat.
  Trigger: run tickets, orchestrate tickets, execute the anexo, play SESSION
  blocks, run *_TICKETS.md.
---

# Ticket orchestrator

**First action:** read this file, then [`policy/tickets.md`](../../policy/tickets.md) §
Token discipline, then `config.yaml` in the kit root. Resolve the
review level (`policy/tickets.md` § Review level). You are the parent.
You do not implement. This is not a design session: do not edit the design, the anexo's
tickets or SESSION fences, or any source file.

SESSION blocks stay the isolation mechanism. You copy each into a **new** subagent.

## When to use

- `run tickets <path to *_TICKETS.md>`
- `run tickets <path> from 3`

## When not to use

- Writing or amending a design (`design-docs`)
- The user already pasted one SESSION block into a new chat (leave it)
- You are the implementer inside a SESSION prompt

## Critical patterns

1. **Prompt.** Before each spawn, run `python3 <kit>/cli.py bundle-session
   --root <repo> --anexo <tickets.md> --session N` (refresh; implementer also
   auto-bundles if missing). Each subagent `prompt` is the fenced block under
   `## SESSION N` (the fence already contains `## Session brief (read first)`;
   do not add a second brief line). No other preface, no prior report, no
   "ticket 1 already did X". Missing
   required fence content blocks dispatch; ask the owner to amend the anexo.
2. **Fresh spawn every ticket.** Never `resume`. Never continue an implementer. Never two
   tickets in one subagent.
3. **Same disk, empty context.** Ticket N+1 reads ticket N's files from the tree. The
   prompt carries no history.
4. **One anexo.** Stop after the last SESSION in the named file. Do not open the next one.
5. **An outer runner may drive this.** A script, CI job, or Flue workflow may
   start this procedure and wait between tickets. Each ticket is still a new
   subagent with the fence as its prompt. The BINDING Factory CLI D6
   (`cli/DESIGN.md`) permits its documented single status-file trailer after
   the unchanged fence. This exception grants no other prompt additions. The runner does not resume an
   implementer and does not put ticket N's report into ticket N+1's prompt.

## Procedure

1. Read the tickets file. Parse `## SESSION N` headings in order; the prompt is the first
   code fence after each. If `vocabulary.program_file` exists next to the anexo,
   it must be BINDING. If absent, require evidence that the existing unit is
   grandfathered under `policy/design.md`; absence alone proves nothing. New
   units require the BINDING program sibling. Otherwise stop.
2. If the user said `from N`, skip earlier sessions.
3. For each remaining N, run `bundle-session` for that N (implementer tickets only;
   optional for `complexity-remover`). For each N, spawn the `implementer` agent
   (`agents/implementer/`). For the last SESSION in the file (remove complexity),
   spawn `complexity-remover` (`agents/complexity-remover/`) instead. Either way, with:
   - `description`: the SESSION heading's short name (3–5 words)
   - `model`: the one in that agent's `agent.yaml`. If it is unavailable, **stop**
     and name the models you have; do not substitute.
   - `prompt`: the fence, verbatim, plus the single `Session brief` line; background off; `resume` unset
4. Wait for it to return, then run the gate below before N+1.
5. After the last SESSION, say the anexo is done and stop.

Default is serial. Launch two implementers at once only when the user names disjoint
tickets that the anexo's Sequence marks parallel.

## Gate (after each ticket)

Resolve the review level (`policy/tickets.md` § Review level). State it before
ticket 1. A later "use full" (etc.) applies to remaining tickets.

1. Show the implementer's report and **stop** if any of: not green; the design is
   ambiguous or wrong ("stop and report"); the implementer started a later ticket or edited
   a folder the ticket did not name.
2. If the report names a choice the design was silent about (anything but none), show it
   and **wait for `continue`**. Do not auto-chain.
3. `full`: spawn `code-reviewer`. If the ticket touched auth, wire, or secrets,
   also `security-reviewer`. If I/O or error paths, also
   `silent-failure-hunter`.
4. `normal` and this is the last SESSION: spawn `code-reviewer` (after
   `complexity-remover` returns on ticket N; separate spawn — no self-review).
5. `flexible`: no auto-spawn after the ticket.
6. Confirm the implementer's Progress settlement (row `GREEN` or `FAILED`,
   handoff on disk). Fix the row only if it is wrong; do not re-run Green-when.
   After `code-reviewer`, set `Verifier` on that row if needed.
7. Green, clean, and no silent choice: start N+1.

Do not fix a failed ticket and do not re-run its commands from the parent. If ticket N
(remove complexity) reports a failure owned by an earlier ticket, stop; do not launch a
"fix the suite" pass as if it were still removing complexity.

## What you must not do

- Write or edit source, the design, or the anexo's fences
- Put ticket N's report into ticket N+1's prompt
- Resume an implementer, or use a developer agent that carries memory across units
