# Factory CLI usage

How to run a phase of tickets unattended. The rules are in [`DESIGN.md`](DESIGN.md). **This program is not built yet.**

## What it does

You name one phase directory. The CLI reads its `*_TICKETS.md` files and a status file, runs the first ticket that is not `done` in a fresh agent, waits for that agent's turn to end, checks the status file, and moves on. One agent at a time. It stops at the first ticket that does not end `done`.

The prompt is the fenced block under `## SESSION N`, then one line telling the agent which status row to set.

## Setup

Once, from the repo root:

```bash
(cd factory/cli && npm ci)
```

You need Node ≥ 22.18, `python3` with PyYAML (for `hooks/guard.py`), and a `factory/config.yaml` with no merge-conflict markers.

In `factory/config.yaml`:

```yaml
cli:
  agent: implementer             # directory under factory/agents/
  harness: cursor                # key in cli.harnesses
  turn_timeout_minutes: 90
  harnesses:
    cursor: { argv: [agent, --model, "{model}", acp], model: sonnet-4 }
    claude: { argv: [claude-agent-acp], env: { ANTHROPIC_MODEL: "{model}" } }
```

- The model is `model` in `factory/agents/<cli.agent>/agent.yaml`, unless the harness entry sets its own `model`. `{model}` in `argv` or `env` is replaced with it.
- `cursor` needs the Cursor `agent` command, already logged in.
- `claude` needs Zed's adapter (`claude-agent-acp`, from npm `@zed-industries/claude-agent-acp`) on `PATH`, with Claude Code credentials it can read.
- If the role, the model, the harness entry, or its command is missing, the ticket stops with reason `config`. The CLI never picks a substitute.

## Commands

```bash
node factory/cli/src/cli.ts list                         # phases that have a *_TICKETS.md
node factory/cli/src/cli.ts status <phase-dir>           # one line per ticket
node factory/cli/src/cli.ts run <phase-dir>              # run every ticket that is not done
```

A shell alias such as `alias factory='node factory/cli/src/cli.ts'` saves typing.

| Exit code | Meaning |
|---|---|
| 0 | Every ticket is `done` |
| 1 | The run stopped at a ticket. `status` shows which, and why |
| 2 | Bad arguments, a broken config file, or another `run` holds the lock |
| 130 | You pressed Ctrl-C. The current ticket is `stopped` with reason `interrupted` |

## Permissions

`hooks/guard.py` answers every tool request from `permissions` in `config.yaml`. `allow` is the only yes. `ask` and `deny` both reject, because nobody is there to answer. A shell request with no readable command is rejected. Secret files, `.git/`, and `git push` are always blocked. If a ticket needs a command the table does not allow, add a rule (or a `config.local.yaml` override) before the run.

Agent questions (`cursor/ask_question`, `cursor/create_plan`) are answered cancelled and the ticket stops with reason `question`.

## Status file

One per phase, at `paths.runs/<phase-name>/status.yaml`:

```yaml
phase: phase-1
tickets:
  - anexo: PHASE1_P1.1_PRINCIPAL_TICKETS.md
    n: 1
    status: done
  - anexo: PHASE1_P1.1_PRINCIPAL_TICKETS.md
    n: 2
    status: stopped
    reason: silent
```

The agent sets only its own row, to `done` or `stopped`. The CLI checks the file after every turn:

| Reason on a stopped row | What happened | What to do |
|---|---|---|
| set by the agent (`silent`, `ambiguous`, …) | The agent stopped on purpose | Read its report, fix the design or answer the question |
| `no result` | The turn ended and the row was still `running` | The agent forgot the trailer line, or crashed |
| `other rows` | The agent changed another ticket's row. The CLI put the file back | Treat the ticket as suspect |
| `bad status` | The agent broke the file. The CLI put it back | Same |
| `question` | The agent asked something | Answer it in the design, then run again |
| `harness exit: …` | The agent process died | The reason holds its exit code and last stderr lines |
| `timeout` | `cli.turn_timeout_minutes` passed | Split the ticket, or raise the limit |
| `interrupted` | Ctrl-C | — |
| `config` | Setup is incomplete | See Setup |

New SESSION headings show up as `pending`. Removed ones drop off. A `done` row is never reset. To redo a `done` ticket, edit its row to `pending` yourself.

## Before you run again

The CLI does not touch git. A stopped ticket's edits are still in the tree, and the next `run` starts that ticket again on top of them. Look at `git status` and `git diff`, then commit, stash, or discard before you rerun.

`done` means the agent said it was green. The CLI did not check that. Review each ticket's diff and run its Green-when commands before you mark the phase landed.
