# factory CLI requirements

Status: draft. Input to the `designer` for `factory/cli/DESIGN.md` and
`factory/cli/CLI_TICKETS.md`. Not BINDING. Open gates are listed at the end and
are not decided here.

## Objective

`factory` is a Rust command-line runner that executes a tickets anexo
(`*_TICKETS.md`) unattended. It speaks the Agent Client Protocol (ACP) to coding
agents (Cursor, Claude Code, and later Codex), and applies the kit's rules the
same way for every agent: one permission table, one gate, one progress record.

Interactive work (design sessions, research, ad-hoc edits) stays in Zed or the
agent's own UI. The CLI exists to make the ticket loop in
[`../skills/ticket-orchestrator/SKILL.md`](../skills/ticket-orchestrator/SKILL.md)
deterministic, so it does not depend on a parent chat following instructions.

## Users and use

- One developer running a BINDING anexo overnight or while away.
- Command shape: `factory run tickets <anexo> [--from N] [--resume]`.
- Success: every ticket either lands green and committed, or the run stops
  with a clear reason and the tree in a known state.

## Scope (v1)

Exec only. No TUI, no chat, no design mode.

### R1. Agent sessions over ACP

- Spawn the agent as a child process and speak JSON-RPC 2.0 over stdio
  (`initialize`, `authenticate`, `session/new`, `session/prompt`).
- One fresh agent process and session per `## SESSION N` block. Never resume a
  session, never put two tickets in one session.
- The prompt is the SESSION fence, verbatim. No preface, no prior report.
- The last SESSION (remove complexity) runs `complexity-remover`; every other
  SESSION runs `implementer`.
- The model and agent come from that agent's `factory/agents/<name>/agent.yaml`. If it
  is unavailable, stop; do not substitute.
- Starting point: `factory/spike/acp-client/` (verified live against Cursor).

### R2. Permissions

- Every `session/request_permission` is decided by `factory/hooks/guard.py`
  against `permissions` in `factory/config.yaml` (plus `config.local.yaml`).
- Unattended means nobody can answer "ask": ask becomes reject.
- An execute request with no readable command is rejected.
- Blocking agent questions (Cursor `cursor/ask_question`, `cursor/create_plan`)
  are answered `cancelled` and the ticket stops for review.
- Secret files and `git push` stay blocked regardless of agent.

### R3. Gate after each ticket

Same order as the ticket-orchestrator skill:

1. Follow `tools.review` (`factory/policy/tickets.md` § Review level). The
   CLI has no chat, so it does not take a session override.
2. `full`: spawn `code-reviewer` (and hunters on trigger). Trust the
   implementer's Green-when report; validation V-rows are covered by ticket
   tests. `normal` on the last SESSION: spawn `code-reviewer` after
   `complexity-remover`.
3. Stop if the implementer reports the design as ambiguous or wrong, started a
   later ticket, or edited a folder the ticket did not name.
4. Stop if the implementer names a choice the design was silent about. The run
   resumes only on an explicit human `--resume`.

The runner does not fix a failed ticket and does not re-run its commands to
make it pass.

### R4. State and progress

- Only the runner edits the anexo's Progress block and Anchor.
- Handoffs go to `paths.runs/<anexo-stem>/ticket-<N>.md`.
- A run state file under `paths.runs/<anexo-stem>/` records, per ticket:
  status (`pending`, `running`, `green`, `stopped`, `limited`), reason, and
  timestamps. `--resume` reads it; `--from N` overrides it.
- State writes are atomic (write temp, rename). A crash leaves the last
  complete state.

### R5. Git

- Each ticket runs in a known tree state and is committed when green
  (`git commit` is allowed in `permissions`; `git push` is blocked).
- An interrupted ticket never carries its half-done edits into the next
  attempt. The attempt restarts from the last green commit.

### R6. Usage limits and scheduled resume

- When an agent session ends on a usage or rate limit, mark the ticket
  `limited`, record the resume time, and stop cleanly.
- Resume time: the reset time the agent reports, if it reports one; otherwise
  `limits.retry_after` from `factory/config.yaml`.
- Schedule a later `factory run tickets <anexo> --resume` (mechanism is a gate).
- The resumed run restarts the limited ticket from scratch (R1, R5).
- Only `limited` resumes automatically. `stopped` (RED, BROKEN, UNRUNNABLE,
  silent choice, ambiguous design) always waits for a human.

### R7. Exit codes and logs

- Distinct exit codes for: anexo done, stopped for review, limited and
  scheduled, runner error.
- Each session's transcript is saved under `paths.runs/<anexo-stem>/`.
- Never write secrets, tokens, or credentials to logs or state files.

### R8. Configuration

- All paths, commands, and permissions come from `factory/config.yaml`. The
  CLI keeps no second copy of a rule.
- New keys (for example `limits.retry_after`, agent binary paths) are added to
  `config.yaml` and documented in `factory/README.md`.

## Non-goals (v1)

- Interactive chat or a TUI; replacing Zed.
- Running design sessions or marking anything BINDING.
- Chaining into the next anexo after the last SESSION.
- Running tickets in parallel.
- Switching to a different agent or model when one is limited (see gates).
- `git push`, PRs, or remote CI.

## Unknowns to research before design

1. How Cursor, Claude Code, and Codex report a usage limit over ACP: error
   code, message, and whether a reset time is included. Verify with the spike;
   do not invent formats.
2. Whether each agent's own hooks (`.cursor/hooks.json`,
   `.claude/settings.json`) also fire when it runs under an ACP client.
3. How the Claude Code ACP adapter maps permission options (`allow-once`,
   `reject-once`) and plan mode.
4. How the validator role runs: as an ACP agent session, or as plain
   commands the runner executes and parses.

## Conflicts with current policy

- The ticket-orchestrator skill forbids "an automation ... to chain tickets".
  R6 adds an automated resume. The skill needs an amendment that allows
  resume only after `limited`, with every gate still applied.

## Open gates

Decide these with the human before the design is BINDING
([`../policy/decisions.md`](../policy/decisions.md)).

1. Crate home: new crate under `factory/cli/`, or grow
   `factory/spike/acp-client/`.
2. Scheduler: the runner sleeps until reset (simple, dies on reboot), or hands
   off to the OS (`systemd-run --user --on-active=...`, survives logout).
3. Tree isolation: one git worktree per ticket, or in place with reset to the
   last green commit.
4. Agent fallback when limited: always wait, or allow switching agents (breaks
   the "do not substitute" rule today).
5. Verifier and validator: ACP agent sessions, or runner-executed commands.

## References

- Loop law: [`../skills/ticket-orchestrator/SKILL.md`](../skills/ticket-orchestrator/SKILL.md)
- Permissions: [`../config.yaml`](../config.yaml), [`../hooks/guard.py`](../hooks/guard.py)
- Spike: [`../spike/acp-client/`](../spike/acp-client/)
- Prior art: `factoryai_docs/` (Droid exec, autonomy levels, permission rules)
