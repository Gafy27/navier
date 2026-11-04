# Factory ticket CLI — tickets and session prompts

Companion to [`DESIGN.md`](./DESIGN.md), not a replacement. The design owns the law, the decisions, and the trade-offs. This file owns the ticket rows, the sequence, the file fences, the validation contract, and **one paste-ready prompt per session**.

Copy **one SESSION block** into a **new agent session**. Do not paste two tickets into one chat. Do not resume a previous ticket's chat. No code lands with this file. To run the anexo without pasting: a new chat with `run tickets factory/cli/CLI_TICKETS.md` (skill `ticket-orchestrator`).

The spec is `draft`. Do not run these tickets until it is BINDING. If the design is ambiguous or you believe it is wrong, **stop and report**.

**Last ticket is always simplify.** Feature work is tickets 1–3. Ticket 4 reads the slice just landed and deletes complexity (`complexity-remover`). It adds no behavior and no public API, and it does **not** fix failures owned by tickets 1–3.

`commands.*` build the product. This unit does not run them. The pinned check is `node --test` on the test file the ticket names.

## Prerequisite

- `factory/config.yaml` parses: no merge-conflict markers. `hooks/guard.py` reads it on every call, and V10 runs the real guard.
- `python3` with PyYAML (already required by `guard.py`), Node ≥ 22.18, and npm on `PATH`.

## Sequence

```
1 -> 2 -> 3 -> 4
```

Strictly serial. Ticket 1 creates `factory/cli/package.json` and its lockfile, and is the only ticket that installs packages. Ticket 3 is the only ticket that edits `factory/config.yaml`, and only its `cli:` keys.

## Tickets

| # | Ticket | Files it may edit | Green when |
|---|--------|-------------------|------------|
| 1 | Package, fence parser, status file, and settle (D1, D3, D4, D6, D7) | `factory/cli/package.json`, `factory/cli/package-lock.json`, `factory/cli/src/tickets.ts`, `factory/cli/src/status.ts`, `factory/cli/src/tickets.test.ts`, `factory/cli/src/fixtures/**` | `node --test factory/cli/src/tickets.test.ts`. V1–V6 hold |
| 2 | Config check and one ACP turn against a fake harness, permissions through `guard.py`, failure outcomes (D2, D5, D6, Permissions, Failure handling) | `factory/cli/src/config.ts`, `factory/cli/src/acp.ts`, `factory/cli/src/acp.test.ts`, `factory/cli/src/fixtures/**` | `node --test factory/cli/src/acp.test.ts`. V7–V12 hold |
| 3 | Subcommands, lock, serial run loop, exit codes, `cli:` keys (D4, D8, Failure handling) | `factory/cli/src/run.ts`, `factory/cli/src/cli.ts`, `factory/cli/src/run.test.ts`, `factory/cli/src/fixtures/**`, `factory/config.yaml` (`cli:` keys only) | `node --test factory/cli/src/run.test.ts`. V13–V16 hold |
| 4 | Simplify the landed slice. No new behavior | Only files tickets 1–3 edited, except `package-lock.json` and `config.yaml` | `node --test factory/cli/src/*.test.ts`. V1–V16 hold |

## Validation contract

Written in the design session, before any code. Each row is a way to break one law. Tests use a fixture phase directory, a fixture config, and a fake ACP child (a small `.ts` script under `src/fixtures/`) that records its argv, env, and prompt, and does what the test tells it. No test spawns `agent`, `claude`, or `claude-agent-acp`.

| V# | Attacks | Kind | Attack | Observable failure | Owner |
|----|---------|------|--------|--------------------|-------|
| V1 | D4 | `cmd` | Status rows: anexo A ticket 1 `pending`, ticket 2 `done`; anexo B ticket 1 `stopped`. Ask for the next row, then mark A1 `done` and ask again | First answer is not A1, or second answer is not B1 | 1 |
| V2 | D3 rebuild | `cmd` | Status has A1 `done`, A2 `stopped` with a reason, A3 `pending`. The markdown now has A1, A2, A4 (A3 heading removed) | A1 is not `done`, A2 lost its status or reason, A3 still listed, or A4 is not `pending` | 1 |
| V3 | G2 | `cmd` | An anexo whose SESSION 1 has two fenced blocks and whose SESSION 2 fence contains a markdown heading line | Prompt 1 is not exactly the first fence's text, or prompt 2 is cut at the inner heading | 1 |
| V4 | D3 settle | `cmd` | After a turn the current row is (a) `done`, (b) `stopped` with reason `silent`, (c) still `running` | (a) not `done`, (b) reason not `silent`, or (c) not `stopped` with reason `no result` | 1 |
| V5 | D3 settle | `cmd` | During the turn the file was rewritten with the current row `done` and another `pending` row set to `done` | Current row is not `stopped` with reason `other rows`, or the other row is not back to `pending` | 1 |
| V6 | D3 settle, atomic write | `cmd` | During the turn the file was overwritten with text that is not YAML. Separately, list the status directory after a CLI write | Row is not `stopped` with reason `bad status`, the file does not parse afterwards, or a temp file is left behind | 1 |
| V7 | D5 | `cmd` | Config cases: role dir with no `model`; harness name not in `cli.harnesses`; `argv[0]` not on `PATH`. Passing case: valid config | Any bad case spawns a child or returns other than `config`, or the valid case does not spawn the fake | 2 |
| V8 | D5 | `cmd` | `argv` and `env` contain `{model}`. Case 1: model only in `agent.yaml`. Case 2: harness entry also sets `model` | The fake's recorded argv or env holds a literal `{model}`, or the wrong model for either case | 2 |
| V9 | D2, D6 | `cmd` | One turn with SESSION 2 of a two-session fixture | Recorded prompt is not fence 2, blank line, trailer; trailer lacks the status path, anexo name, or `2`; or fence 1 text appears | 2 |
| V10 | Permissions | `cmd` | Fake requests, in turn: execute `git status`; execute `git push`; execute with no command; edit of `src/a.c`; edit of `.env` (path only in `locations`) | Answers are not allow, reject, reject, allow, reject, in that order | 2 |
| V11 | Failure handling | `cmd` | (a) fake exits with code 3 mid-turn and writes to stderr; (b) fake never answers, turn timeout 200 ms | (a) outcome is not `harness exit` with the code and stderr in the reason; (b) outcome is not `timeout`, or the fake's pid is still alive afterwards | 2 |
| V12 | Permissions, questions | `cmd` | Fake sends `cursor/ask_question` | Reply is not cancelled, or outcome is not `question` | 2 |
| V13 | D4 | `cmd` | Fixture with three rows. Run 1: fake sets row 1 `done`, row 2 `stopped`. Run 2: fake sets every row it gets to `done` | Run 1 spawns a third child or exits other than 1; two children ever overlap; run 2 starts at a row other than row 2, or exits other than 0 | 3 |
| V14 | D8 | `cmd` | `list` over a designs dir with one phase holding a `*_TICKETS.md` and one without; `run` with no argument | The empty phase is listed, or `run` without an argument does not exit 2 | 3 |
| V15 | Lock | `cmd` | (a) `run.lock` holds a live pid; (b) `run.lock` holds a dead pid and a row is `running` | (a) any spawn, status change, or exit other than 2; (b) that row is not `stopped` with reason `no result`, or the run does not continue to the next row | 3 |
| V16 | Failure handling | `cmd` | Send SIGINT to a `run` child process while the fake is mid-turn | Row is not `stopped` with reason `interrupted`, the fake is still alive, the lock file remains, or exit code is not 130 | 3 |

**Not attackable:** D1 (the program exists as TypeScript under `factory/cli/`), D7 (the package file is the check), D9 (an absence of code; no test makes it more true).

## Progress

Maintained **only by `ticket-orchestrator`**. Nobody else edits this block, and it is never pasted into a prompt.

| # | State | Attempts | Verifier | Validator | Handoff |
|---|-------|----------|----------|-----------|---------|
| 1 | PENDING | 0 | — | — | — |
| 2 | PENDING | 0 | — | — | — |
| 3 | PENDING | 0 | — | — | — |
| 4 | PENDING | 0 | — | — | — |

Handoffs are stored at `paths.runs/CLI_TICKETS/ticket-<N>.md`.

### Anchor

- **Intent:** <!-- factory CLI: list/status/run, status yaml settled by the CLI, one ACP agent at a time -->
- **Files touched so far:** <!-- cumulative -->
- **Decisions:** <!-- silent choices a human `continue`d, with ticket # -->
- **Open issues → owner / Next:** <!-- issue → ticket or design; next ticket -->

## Fences every ticket runs

This unit does not run `commands.*`.

```
node --test factory/cli/src/tickets.test.ts
```

Ticket 2 substitutes `factory/cli/src/acp.test.ts`. Ticket 3 substitutes `factory/cli/src/run.test.ts`. Ticket 4 runs `node --test factory/cli/src/*.test.ts`.

## What no ticket may do

- Add a Rust crate, a vendor Agent SDK, a PTY, or any package beyond D7's two.
- Change `hooks/guard.py` or the `permissions` table.
- Edit a `*_TICKETS.md` fence in `templates/` or a product phase.
- Resume or reuse an ACP session, or have two harness children alive at once.
- Reset a `done` row.
- Run git commands that change the tree or the index, or `commands.*`.

---

## SESSION 1 — Ticket 1: package, fences, status file

```
You are implementing an already-locked design. This is not a redesign.

Design: factory/cli/DESIGN.md (BINDING). This session is ticket 1 only. Stop
when it is green. Do not start later tickets. Do not edit the design. Do not
touch folders this ticket does not name.

## Read before writing code, in this order

1. factory/AGENTS.md, factory/policy/tickets.md, factory/policy/testing.md.
2. factory/stack/typescript/code-style.md, factory/stack/typescript/testing.md.
3. Skill ticket-testing, then testing-code.
4. factory/cli/DESIGN.md: Overview (including the Settle table), D1, D3, D4,
   D6, D7, and Data storage. This anexo's Progress block: the Anchor and
   ticket 1's row.
5. factory/templates/TICKETS.md from "## SESSION 1" through the end of that
   fence, as the shape you parse. factory/cli/CLI_TICKETS.md rows V1-V6.

## This ticket lands

factory/cli/package.json: private, "type": "module", engines node >=22.18,
and exactly two dependencies pinned to exact versions, @agentclientprotocol/sdk
and yaml, with package-lock.json from npm install --save-exact.

tickets.ts: given a phase directory, return each *_TICKETS.md in filename order
and, within a file, each ## SESSION N in order, with the text of the first
fenced block under that heading.

status.ts: build, load, and atomically write paths.runs/<phase-name>/status.yaml
as Data storage describes; pick the next row that is not done; and settle a
row after a turn from a snapshot, as the Settle table describes. Settle takes
the snapshot and the turn outcome and returns what to write. It does not spawn.

## Rules specific to this ticket

Do not spawn a process. Do not speak ACP. Do not read cli.* keys. Do not edit
factory/config.yaml.

## Green when

node --test factory/cli/src/tickets.test.ts

V1-V6 hold. Do not run the product commands.

## Report

End with these six headings, in this order:
### Done
### Not done
### Commands
### Choices the design was silent on
### Discovered issues
### Files touched
```

---

## SESSION 2 — Ticket 2: one ACP turn

```
You are implementing an already-locked design. This is not a redesign.

Design: factory/cli/DESIGN.md (BINDING). This session is ticket 2 only. Stop
when it is green. Do not start later tickets. Do not edit the design. Do not
touch folders this ticket does not name.

## Read before writing code, in this order

1. factory/AGENTS.md, factory/policy/tickets.md, factory/policy/testing.md.
2. factory/stack/typescript/code-style.md, factory/stack/typescript/testing.md.
3. Skill ticket-testing, then testing-code.
4. factory/cli/DESIGN.md: D2, D5, D6, Permissions, Failure handling (outcomes
   only, not the lock), and the cli: keys under Data storage. This anexo's
   Progress block: the Anchor and ticket 2's row.
5. factory/hooks/guard.py: main(), command_of(), collect_paths(), emit().
   The README of @agentclientprotocol/sdk in factory/cli/node_modules.
6. factory/cli/src/tickets.ts and status.ts as they landed.
   factory/cli/CLI_TICKETS.md rows V7-V12.

## This ticket lands

config.ts: from a loaded config object and the kit directory, resolve the role
model, the harness argv and env with {model} substituted, and the turn timeout,
or return reason config without spawning (D5).

acp.ts: one function that spawns the resolved harness, opens one ACP session
through the SDK's ClientSideConnection with no fs and no terminal capability,
sends one prompt (fence, blank line, D6 trailer), and returns exactly one
outcome from the Failure handling table. Permission requests are answered as
the Permissions table says, by running factory/hooks/guard.py with the JSON
payload it shows. The child is dead when the function returns.

Tests drive a fake harness under src/fixtures/. They do not spawn agent,
claude, or claude-agent-acp.

## Rules specific to this ticket

Do not implement subcommands, the lock, or the multi-ticket loop. Do not write
the status file. Do not change hooks/guard.py or the permissions table.

## Green when

node --test factory/cli/src/acp.test.ts

V7-V12 hold. Do not run the product commands.

## Report

End with these six headings, in this order:
### Done
### Not done
### Commands
### Choices the design was silent on
### Discovered issues
### Files touched
```

---

## SESSION 3 — Ticket 3: subcommands and the run loop

```
You are implementing an already-locked design. This is not a redesign.

Design: factory/cli/DESIGN.md (BINDING). This session is ticket 3 only. Stop
when it is green. Do not start later tickets. Do not edit the design. Do not
touch folders this ticket does not name, except the cli: keys in
factory/config.yaml.

## Read before writing code, in this order

1. factory/AGENTS.md, factory/policy/tickets.md, factory/policy/testing.md.
2. factory/stack/typescript/code-style.md, factory/stack/typescript/testing.md.
3. Skill ticket-testing, then testing-code.
4. factory/cli/DESIGN.md: Overview, D4, D8, Failure handling (lock, signals,
   exit codes), Data storage. This anexo's Progress block: the Anchor and
   ticket 3's row.
5. factory/cli/src/tickets.ts, status.ts, config.ts, and acp.ts as they landed.
   factory/cli/CLI_TICKETS.md rows V13-V16.
6. If factory/config.yaml contains conflict markers, stop and report. Do not
   edit either side of a conflict.

## This ticket lands

cli.ts: the entry, run as node factory/cli/src/cli.ts <subcommand>. list,
status <phase-dir>, and run <phase-dir>, with the exit codes the design lists.
Usage errors print one line of usage on stderr.

run.ts: take the lock, rebuild status, settle a stale running row, then for
each row that is not done: snapshot, set running, call the ticket 2 turn,
settle, write. One stderr line per turn start and per settle. On SIGINT or
SIGTERM, end the current turn as interrupted, settle, release the lock, exit 130.

factory/config.yaml: add cli.agent, cli.harness, cli.turn_timeout_minutes, and
cli.harnesses (cursor and claude), as Data storage shows. Record the real argv
for each harness; do not discover it at runtime.

## Rules specific to this ticket

Tests spawn cli.ts as a child process with a fixture config and the ticket 2
fake harness. Do not spawn a real agent. Do not reset done rows. Do not run
two tickets in one ACP session.

## Green when

node --test factory/cli/src/run.test.ts

V13-V16 hold. Do not run the product commands.

## Report

End with these six headings, in this order:
### Done
### Not done
### Commands
### Choices the design was silent on
### Discovered issues
### Files touched
```

---

## SESSION 4 — Ticket 4: simplify landed code

```
You are implementing an already-locked design. This is not a redesign.

Design: factory/cli/DESIGN.md (BINDING). This session is ticket 4 only: the
mandatory simplify pass. Stop when it is green. Do not start other tickets.
Do not edit the design. Do not add features, types, dependencies, or public API.

Earlier tickets landed the slice. Make it smaller and easier to read. Delete
lines. Flatten layers that exist only once. Drop names that do not earn their
keep. Behavior and tests stay the same.

## Read before writing code, in this order

1. factory/AGENTS.md (Simplicity First, Surgical Changes).
2. complexity-remover instructions, then factory/stack/typescript/code-style.md.
3. factory/cli/DESIGN.md. Decisions that must still hold stay.
4. This anexo's Progress block (the whole Anchor).
5. The files tickets 1-3 edited. Do not wander the rest of the repo.

## This ticket lands

A net-smaller version of the same slice. If the code is already as small as
the design allows, say so, change nothing, and still run the tests.

## Rules specific to this ticket

No new behavior. No new tests, except to replace a test that only covered
deleted private structure. Do not fix failures that tickets 1-3 should have
caught. Stop and report the owning ticket. Do not loosen or delete tests.

## Green when

node --test factory/cli/src/*.test.ts

V1-V16 hold. Do not run the product commands.

## Report

Same six headings as SESSION 1. Under Done, list what you deleted or inlined
and the skills you applied. Under Discovered issues, name the owning ticket of
any failure that did not come from this simplify, and stop.
### Done
### Not done
### Commands
### Choices the design was silent on
### Discovered issues
### Files touched
```
