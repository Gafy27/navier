# Caveman

Every agent **reads** skill `caveman` at **full** each session
([`rules.md`](rules.md) § Caveman). When `tools.caveman` is true in
`config.yaml`, every agent's **chat reply** follows that skill. Fat CLI dumps go through
`caveman tools shrink`. [`rules.md`](rules.md) § Tone is a pointer. Speech body is the official
skill, copied verbatim — do not edit
[`../skills/caveman/SKILL.md`](../skills/caveman/SKILL.md). Refresh with
`caveman tools skills preview caveman`. Aliases: `ultracave` (`/caveman
ultra`), `megacave` (`/caveman wenyan`).

Source: [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
via `@caveman-ai/cli` (this machine: 4.0.1). Host proxy/hooks for Claude
Code stay in `~/.claude/`; `install.py` does not own them.

## Precedence

1. BINDING designs, tickets, `AGENTS.md`, and this kit's other policy files
   win on conflict.
2. **Ponytail** ([`ponytail.md`](ponytail.md)) still owns code size. Caveman
   owns tokens and reply speech. Do not replace Ponytail with Caveman.
3. **Memory** stays [`memory.md`](memory.md) / `paths.memory`. Never
   `caveman mem`.
4. Chat speech is the Caveman skill only. No ADHD overlay.
5. Artifacts stay kit English: code, comments, commits, PRs, specs, tickets,
   index notes. Design-doc prose may use the sentence rules in
   [`design.md`](design.md) § Architecture **Redaction**. That is not Caveman
   voice, and it does not apply to code.

## CLI

Cursor factory agents wrap Firecrawl, REA, `cargo tree`, and graphify query
dumps when output is likely > ~400 lines. Missing binary: run bare, say so.

```
caveman tools shrink -- firecrawl <args>
caveman tools shrink -- npx -y rea-agents@6.4.0 <args> --format json
caveman tools shrink -- cargo tree --locked -i <unit>
caveman tools shrink -- graphify query "<question>"
```

JSON already on disk: `caveman compress` on stdin. Original: `caveman retrieve`.

Do not call from agents: `mem`, `browse`, `convert`, `mcp`, `hooks`, `wrap`,
`login`, cloud verbs.

## Hosts

- **Claude Code:** already on the proxy (`caveman status`). Speech still
  follows the skill so Cursor and Claude match.
- **Cursor / ticket CLI:** no Caveman wrap of the harness. Shrink is the
  Bash prefix above.

## Install

Skills `caveman`, `ultracave`, `megacave` linked when `tools.caveman` is
true. Machine: `npm i -g @caveman-ai/cli` then `caveman setup`. License:
Apache-2.0 (`skills/caveman/LICENSE`).
