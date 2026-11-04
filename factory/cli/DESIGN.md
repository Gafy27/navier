# Factory ticket CLI

**Status: BINDING.**

**Depends on:** [`../skills/ticket-orchestrator/SKILL.md`](../skills/ticket-orchestrator/SKILL.md), [`../hooks/guard.py`](../hooks/guard.py), [`../config.yaml`](../config.yaml).

This unit lives in the kit (`factory/cli/`), not under `paths.designs`. `paths.designs` is the product tree. The kit README row for `cli/` is the map. Tickets: [`CLI_TICKETS.md`](CLI_TICKETS.md). Operator guide: [`USAGE.md`](USAGE.md).

## Context and scope

A `*_TICKETS.md` anexo holds one paste-ready prompt per ticket: the first fenced block under each `## SESSION N` heading. The [ticket-orchestrator skill](../skills/ticket-orchestrator/SKILL.md) runs those prompts one fresh agent at a time and stops when a ticket is not green. Today that loop depends on a parent chat following the skill.

This CLI runs the same loop as a program. It speaks the Agent Client Protocol (ACP, newline-delimited JSON-RPC on stdio) to a harness process (Cursor's `agent acp`, or Zed's Claude Code adapter), and answers every permission request from the kit's own table through `hooks/guard.py`.

It does not build the product and does not use `commands.*`. Those keys belong to the product.

## Goals and non-goals

**Goals**

- G1. `factory run <phase-dir>` runs that phase's tickets, serially, skipping `done`.
- G2. The prompt for a ticket is that SESSION fence, unchanged, plus one trailer line (D6).
- G3. One status file per phase lists every ticket. Re-running the same command resumes at the first row that is not `done`.
- G4. One agent process at a time. A turn that hangs, crashes, or is interrupted ends with its row `stopped` and a reason, never a stuck `running`.
- G5. The kit role and the harness are config. Nothing about a vendor is a literal in code.

**Non-goals**

- Design sessions, research sessions, and marking a spec BINDING.
- Parallel tickets, switching harness when one is limited, and scheduled resume.
- Running Green-when from the parent. The SESSION fence tells the implementer to run Green-when. `done` is the agent's report (D3).
- Git. The CLI does not check, reset, or commit the tree (D9).
- Editing the anexo Progress block. The status file is the run record.
- A TUI, an interactive menu, git push, pull requests, and saving transcripts.

## The actual design

### Overview

```
factory list                 phase dirs under paths.designs that hold a *_TICKETS.md
factory status <phase-dir>   the status rows, one per line
factory run <phase-dir>      run every row that is not done, one at a time
```

The kit directory is the parent of `factory/cli/`. Relative paths in `config.yaml` (`paths.designs`, `paths.runs`) and the `<phase-dir>` argument resolve against the repo root, which is the kit's parent directory. Code takes the loaded config and these roots as arguments, so tests can point it at a fixture tree.

`run` takes the phase lock, rebuilds the status file from the SESSION headings, and walks anexos in filename order and sessions in heading order. For the first row that is not `done` it snapshots the file, sets the row to `running`, spawns the harness, sends one prompt, and waits for the turn to end. It then **settles** the row (below). `done` continues to the next row. Anything else ends the run.

**Settle.** After every turn the CLI re-reads the status file and compares it to the snapshot:

| What the CLI finds | Row becomes | Reason |
|---|---|---|
| Current row `done`, nothing else changed | `done` | — |
| Current row `stopped`, nothing else changed | `stopped` | the agent's reason |
| Current row still `running` | `stopped` | `no result` |
| File does not parse, or does not have the shape below | `stopped` | `bad status` |
| Any other row changed | `stopped` | `other rows` |
| The turn ended early (see Failure handling) | `stopped` | that outcome |

In the last three cases the CLI rewrites the whole file from the snapshot, so an agent cannot mark another ticket `done`. Every CLI write is atomic (write a temp file in the same directory, then rename).

### Decisions

D1. TypeScript under `factory/cli/`, run by Node ≥ 22.18 with type stripping (no build step), tests on `node:test`, as [`../stack/typescript/code-style.md`](../stack/typescript/code-style.md) describes. Human picked TypeScript.

D2. Each ticket is a new harness child and a new ACP session: `initialize`, `session/new`, one `session/prompt`. The child is killed when the turn settles. A session is never resumed or reused. The client advertises no `fs` and no `terminal` capability, so the agent uses its own tools and every tool use reaches the CLI only as `session/request_permission`. Human picked ACP.

D3. One status file per phase, at `paths.runs/<phase-name>/status.yaml`. The CLI creates it and is the only writer of `pending` and `running`. The agent changes only its own row, to `done` or `stopped`, with an optional `reason`. The CLI settles the row as in the Overview. Human picked one YAML of all tickets, filled by the agent.

D4. A run is one phase, serial, skipping `done`. A row that is not `done` after settle ends the run. Human picked sequential not-done tickets and one agent at a time.

D5. `cli.agent` names a directory under `factory/agents/`. Its `agent.yaml` `model` is the session model. `cli.harness` names an entry in `cli.harnesses`: an `argv` and an optional `env`. The string `{model}` in either is replaced with the model. An entry may set its own `model`, which wins over `agent.yaml`, because the same model has different names in different harnesses. If the role directory, the model, the harness entry, or its `argv[0]` on `PATH` is missing, nothing is spawned and the row is `stopped` with reason `config`. The CLI never substitutes a model or a harness. Human picked both settings.

D6. The prompt is the SESSION fence's text, then one blank line, then one trailer line naming the status-file path, the anexo name, the ticket number, and the instruction to set only that row to `done` or `stopped` before ending the turn. The fence text is not rewritten. Human picked this over a fence-only prompt, because current anexos do not mention the status file.

D7. Two runtime dependencies, pinned exactly in `factory/cli/package.json` with a committed lockfile: `@agentclientprotocol/sdk` (the ACP client, `ClientSideConnection` over the child's stdio) and `yaml` (config and status file). No other packages. Human picked the official SDK over hand-written JSON-RPC.

D8. Three subcommands, `list`, `status`, `run`, each with explicit arguments. No interactive menu, and the same behavior with or without a terminal. Human picked subcommands over the numbered menu.

D9. No git handling. A stopped ticket's partial edits stay in the tree, and the next `run` starts that row again on top of them. [`USAGE.md`](USAGE.md) tells the operator to inspect and clean up first. Human picked this over refusing a dirty tree and committing each green ticket.

### Permissions

Every `session/request_permission` is answered by running `python3 factory/hooks/guard.py` once, with this JSON on stdin:

```json
{ "hook_event_name": "factory-cli", "tool_input": <toolCall.rawInput>, "tool_call": <toolCall> }
```

The lowercase event name makes guard treat the CLI as a host that can ask, so guard returns `allow`, `ask`, or `deny` without rewriting. Guard finds a shell command in `tool_input.command` and file paths anywhere in the payload, including `toolCall.locations[].path`. It always blocks secret files and `.git/`.

| Request | Answer |
|---|---|
| guard says `allow` | the agent's `allow_once` option |
| guard says `ask` or `deny` | the `reject_once` option. Nobody is there to answer `ask` |
| `kind` is `execute` and no command string is found | reject, without calling guard |
| any other kind with no command (edit, read, delete, move) | guard decides from the paths |
| guard exits without one JSON object on stdout, or does not return in 10 s | reject |
| the request has no option of the needed kind | reject if one exists, otherwise cancelled |

Cursor's `cursor/ask_question` and `cursor/create_plan` are answered cancelled. The turn ends with outcome `question`.

### Failure handling

A turn ends in exactly one outcome. All but `returned` become a `stopped` row with that reason, without reading the agent's edits to the status file.

| Outcome | Trigger | CLI action |
|---|---|---|
| `returned` | `session/prompt` resolved | settle as in the Overview |
| `question` | `cursor/ask_question` or `cursor/create_plan` | answer cancelled, kill the child |
| `harness exit` | the child exited, or ACP failed, before `session/prompt` resolved | record the exit code and the last 20 stderr lines in `reason` |
| `timeout` | `cli.turn_timeout_minutes` elapsed | send `session/cancel`, then SIGTERM, then SIGKILL after 5 s |
| `interrupted` | SIGINT or SIGTERM to the CLI | same kill sequence, then exit 130 |
| `config` | D5 check failed | nothing is spawned |

**Lock.** `run` creates `paths.runs/<phase-name>/run.lock` exclusively (`O_EXCL`), containing its pid. If the file exists and that pid is alive, `run` exits 2 without touching the status file. If the pid is dead, the lock is stale: `run` replaces it and settles any `running` row as `stopped` with reason `no result` before it picks the next row.

**Exit codes.** `0`: every row is `done`. `1`: the run ended on a `stopped` row. `2`: usage, config file, or lock error before any turn. `130`: interrupted.

### System context

```
phase dir/*_TICKETS.md --fence--> factory run --ACP stdio--> harness child
agents/<role>/agent.yaml --model-->     |                         |
paths.runs/<phase>/status.yaml <--rw--> |  <--session/request_permission
                                        +--stdin JSON--> hooks/guard.py --> config.yaml permissions
```

### Data storage

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

`status` is `pending`, `running`, `done`, or `stopped`. `reason` is at most 2000 characters, and the CLI cuts it to that. On each `run` and `status` the CLI rebuilds the list from the markdown: it keeps the status and reason of each `(anexo, n)` that still exists, adds new ones as `pending`, and drops ones whose SESSION heading is gone. A `done` row is never reset.

Config keys this unit adds to `config.yaml`, under `cli:` only:

```yaml
cli:
  agent: implementer
  harness: cursor
  turn_timeout_minutes: 90
  harnesses:
    cursor: { argv: [agent, --model, "{model}", acp], model: sonnet-4 }
    claude: { argv: [claude-agent-acp], env: { ANTHROPIC_MODEL: "{model}" } }
```

The values shown are examples. The ticket that adds the keys records real ones.

## Alternatives considered

- **The CLI runs Green-when and reads the report instead of trusting the status file.** It would remove the trailer, the snapshot compare, and the `other rows` case, and `done` would be proven, not claimed. Rejected by the human for D3 and D6.
- **Refuse a dirty tree and commit each green ticket.** A known start state, and an interrupted ticket cannot leak into its retry. Rejected by the human for D9. The cost is in Cross-cutting: Trust.
- **Hand-written JSON-RPC and a YAML subset parser.** Zero dependencies, but more code to own, and Node has no YAML parser. Rejected by D7.
- **Print mode** (`claude -p`, `agent -p`). A process exit is a clear end, but it cannot ask `guard.py` about each command. A permission-mode flag allows or denies the whole turn. Rejected: the kit permission table is per command.
- **A PTY that scrapes the interactive UI** (ccmanager). There is no end signal, and a wording change looks like a hang. Rejected for G4.
- **Vendor Agent SDKs.** Two libraries and two auth paths, with session resume built in. The Claude SDK does not drive Cursor. Rejected for G5.
- **A Rust runner** (the earlier requirements draft, now in git history). Same protocol and permission table. Rejected by D1.
- **The interactive numbered menu.** It needs a separate code path for terminals and is harder to test. Rejected by D8. `list` prints the same information.
- **A model field in the ACP session.** ACP has no stable model parameter. `session/set_model` is unstable in the SDK. Rejected for D5's argv and env substitution, which each harness's own CLI already supports.

## Cross-cutting concerns

**Trust.** `done` is what the agent wrote. A green-looking run proves only that each agent claimed success. Settle stops an agent from claiming another ticket's row, but it does not stop a false claim on its own row. With D9, a retried ticket also inherits its previous attempt's edits. Review each `done` ticket's diff before marking the phase landed.

**Dependency direction.** The CLI reads `config.yaml`, `agents/<role>/agent.yaml`, and the phase's `*_TICKETS.md`. It spawns the harness and `hooks/guard.py`. It does not import product code and does not change `guard.py` or `permissions`.

**Secrets.** Guard blocks secret files, `.git/`, and `git push`. The status file stores a status and a short reason, never the prompt, never the environment. `harness exit` reasons include stderr lines, which the CLI cuts to 2000 characters. The CLI writes no transcript. `env` values in `cli.harnesses` hold model names, not keys: the harness reads its own credentials.

**Supply chain.** Two pinned packages, with a committed lockfile. Install with `npm ci`.

**Observability.** One line on stderr per turn start and per settle (anexo, n, outcome, reason). The status file and the exit code are the record. No telemetry.

**Product contract.** This CLI does not change `paths.product_contract`. It only runs tickets that already exist.

**Borrowed.** ACP stdio transport and `@agentclientprotocol/sdk` (Zed). ccmanager's PTY approach was considered and not used.

## Review response

Review has not run.

| # | Point | Response | Changed |
|---|-------|----------|---------|
| | | | |
