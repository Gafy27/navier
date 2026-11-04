# Host loaders

One set of pointers for **every** agent host (Cursor, Claude, Codex, …).
They are not a second copy of the law. They point at the repo
[`../../AGENTS.md`](../../AGENTS.md) and [`../policy/`](../policy/).

These files assume the kit folder is named `factory/` at the repo root
(`paths.kit` in [`../config.yaml`](../config.yaml)). If you rename the folder,
rewrite `factory/` in every copied file.

Frontmatter (`alwaysApply`, `globs`) is for hosts that honor it. Hosts that
load every file in the rules dir still get the same text; Graphify,
Firecrawl, REA, Ponytail, and Caveman skip when `tools.*` is false.

## Install

From the adopting repo root:

```
python3 factory/cli.py install
```

That writes `AGENTS.md` from `config.yaml`, renders `agents/<name>/` to
`.agents/agents/<name>.md`, preserving declared skill names and host metadata.
Selected-stack agents are rendered when skills or startup pointers apply;
otherwise they remain symlinks. Optional skill metadata and appended directives
follow configured flags. The installer symlinks skills and copies loaders into
`.claude/rules/` and `.cursor/rules/*.mdc`.

Firecrawl skills are linked only when `tools.firecrawl` is true. Graphify
is linked only when `tools.graphify` is true. REA is linked only when
`tools.rea` is true. Ponytail skills are linked when `tools.ponytail` is true. The write line
(`full`) is appended to `implementer`. The ultra line is appended to
`complexity-remover`. `full` is also appended to `rust-senior-developer` when enabled. The review line only to `code-reviewer`.
Caveman is linked, and a Caveman line is appended to every rendered
agent, only when `tools.caveman` is true.
Method skills always link.
The source is `factory/skills/` and `factory/stack/<language>/skills/`.
Host skill dirs point at `.agents/skills/`, which points at the kit.

Do **not** copy a `read-claude-md` file. `policy.md` replaced it.

Leave `.claude/settings.json` and `paths.memory` in the adopting repo. They
are not kit.

Sessions start at the repo `AGENTS.md`. Task choice is the `factory-router`
skill. Edit [`../policy/`](../policy/) when the method changes, then re-run
the installer.

CLIs: `uv tool install graphifyy` and `firecrawl setup core -g -y` (auth only;
skills already in the kit). REA needs only Node; check with
`npx -y rea-agents@6.4.0 doctor --json`. Caveman: `npm i -g @caveman-ai/cli`
then `caveman setup`.

Rust glob files (`jon-gjengset-rust.md`, `fast-tokio.md`) no-op on a tree
with no `*.rs`. Kit-relative copies for reading the pack:
[`../stack/rust/rules/`](../stack/rust/rules/).

`basilisk.md` globs `*.c` and `*.h`. It no-ops on a tree with no solver C.
Kit-relative copy: [`../stack/c/rules/basilisk.mdc`](../stack/c/rules/basilisk.mdc).

## Always-on

`policy.md`, `graphify.md`, `firecrawl.md`, `rea.md`, `ponytail.md`, `caveman.md`, `agents.md`, `decisions.md`, `memory.md`.

## Task-triggered

`design-docs.md`, `indexing.md`, `ticket-verify.md`, `testing-code.md`,
`secure-code.md`, `tone-and-workflow.md`, `reliability-security.md`.

## Do not ship in this folder

- `.claude/settings.json` (default agent)
- Agent memory (it lives at `paths.memory`, its own git repo)
- Host skill / agent trees (those symlink to `.agents/`)
- Product globs (`paths.designs`, crate names)
