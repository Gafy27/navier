# Factory kit installation (cosmos-engine)

Step-by-step setup for the portable agent method in [`factory/`](factory/). The kit lives in its **own git repository**; this repo lists `factory/` in [`.gitignore`](.gitignore) so you clone or copy it beside the Rust tree. Authoritative kit docs: [`factory/README.md`](factory/README.md).

Installation is **deterministic and local**: it validates config and profile, then writes symlinks and generated files. It does not download Rust crates, start services, or install optional CLI tools unless you run those steps yourself.

---

## What you get after install

Running the installer (step 7) generates host bindings from [`factory/config.yaml`](factory/config.yaml):

| Output | Purpose |
|--------|---------|
| [`AGENTS.md`](AGENTS.md) | Repo entrypoint for agents (commands, authority order, hard stops) |
| `.agents/agents/*.md` | Rendered kit agents |
| `.agents/skills`, `.cursor/skills`, `.claude/skills` | Symlinks to selected `factory/skills/` |
| `.cursor/rules/`, `.claude/rules/` | Copied loaders (pointers into `factory/policy/`) |
| Hooks | Shell guard from `factory/hooks/` (enforces `permissions` in config) |

If `paths.obsidian_vault` is set, install also refreshes `Templates/Research capture.md` in that vault. Install does **not** run Graphify extract/export.

**Do not hand-edit** generated `AGENTS.md` or the copies under `.agents/`, `.cursor/`, or `.claude/`. Change [`factory/config.yaml`](factory/config.yaml), profile, policy, or agents, then re-run install.

---

## Prerequisites

1. **Python 3** (3.10+ recommended) on your `PATH` as `python3`.
2. **Git** and a checkout of **cosmos-engine** (this repository).
3. **Rust toolchain** for building the product (not required to *install* the kit, only to run verification commands listed in `AGENTS.md`).
4. For this project as configured:
   - Obsidian vault at `obsidian/Cosmos Engine/` with [`README.md`](<obsidian/Cosmos Engine/README.md>) (required because `paths.obsidian_vault` is set in config).
   - Optional: separate knowledge-base vault at the path you set in local config (see step 4).

---

## Step 1 — Place the factory kit at the repo root

From the **cosmos-engine** root:

```bash
cd /path/to/cosmos_engine
```

Ensure a `factory/` directory exists with at least:

- `factory/config.yaml`
- `factory/cli.py` (CLI entry)
- `factory/setup/` (Python library)
- `factory/profile/` (filled product profile for Cosmos)
- `factory/policy/`, `factory/skills/`, `factory/agents/`, …

**Cosmos layout:** clone or pull the factory kit into `factory/`. The parent repo intentionally does not track that folder.

**Adopting factory in another repo:** copy the whole kit directory to `<project-root>/factory/`, then continue from step 3 using `factory/profile/example/` as the profile template (see [`factory/profile/example/README.md`](factory/profile/example/README.md)).

---

## Step 2 — Install Python dependencies for the guided CLI

In your chosen Python environment (venv or system):

```bash
python3 -m pip install -r factory/requirements.txt
```

Pinned packages: `click`, `PyYAML`. Nothing else is installed automatically by the kit.

---

## Step 3 — Configure `factory/config.yaml`

[`factory/config.yaml`](factory/config.yaml) names **this** project: language, paths (designs vault, graphify, memory), shell commands (`cargo check`, …), enabled tools (`graphify`, `firecrawl`, `ponytail`, …), and permissions.

For **cosmos-engine**, the committed kit config already points at:

- `paths.profile`: `factory/profile`
- `paths.obsidian_vault`: `obsidian/Cosmos Engine`
- `project.language`: `rust` and Rust verification commands

For a **new** repo, run the guided inspector and use the printed agent prompt to fill config and profile:

```bash
python3 factory/cli.py setup --root . --output factory-profile-prompt.md
```

That command does not install anything; it lists missing requirements and saves a kickoff prompt (it refuses to overwrite an existing output file).

---

## Step 4 — Optional machine-local overrides (`config.local.yaml`)

Create **gitignored** [`factory/config.local.yaml`](factory/config.local.yaml) for paths that differ per machine (for example an absolute knowledge-base root):

```yaml
paths:
  knowledge_base: /absolute/path/to/kb
```

On install, `paths` keys in this file **merge over** `factory/config.yaml`. If `paths.knowledge_base` is set, the directory must exist and contain `INDEX.md` or install will fail.

Cosmos often leaves `knowledge_base` empty in committed config and sets it only in `config.local.yaml`.

---

## Step 5 — Product profile (nine documents)

The installer refuses to run until `paths.profile` (default `factory/profile/`) contains nine filled Markdown files with no `<!-- UNFILLED -->` markers:

`README.md`, `requirements.md`, `layering.md`, `stack.md`, `code-style.md`, `testing.md`, `skills.md`, `tickets.md`, `agents.md`

**Cosmos:** these are already maintained under [`factory/profile/`](factory/profile/).

**New repo:** copy from [`factory/profile/example/`](factory/profile/example/), rewrite names and laws, remove every `UNFILLED` marker, and complete **all** sections in `testing.md` (Test selection, Launch, Doctor, Drive, Evidence, Cleanup) with real project commands.

---

## Step 6 — Preflight check

From the repo root:

```bash
python3 factory/cli.py check --root .
```

If the kit is not at `<root>/factory`, pass `--kit /path/to/factory` (the directory that contains `config.yaml`).

Fix every `ERROR:` line (missing vault, broken profile links, invalid config shape, agent contract issues). Success means **structurally ready**, not behaviorally verified.

Shortcut when the tree is already configured:

```bash
python3 factory/cli.py check
```

(`--root` defaults to the parent of the kit when you run a script inside `factory/`.)

---

## Step 7 — Install into the host repo

Both entrypoints share [`factory/cli.py`](cli.py) and run the same checks:

```bash
python3 factory/cli.py install --root .
# or
python3 factory/cli.py install --root .
# bare install.py (no subcommand) defaults to install:
python3 factory/cli.py install
```

Use `--kit` when the kit directory is not `<root>/factory`.

Expected success line:

```text
installed factory kit into AGENTS.md, .agents/, .cursor/, .claude/
```

Re-run install after you change `factory/config.yaml`, `factory/config.local.yaml`, loaders, agents, or which tools are enabled.

---

## Step 8 — Confirm generated entrypoints

1. Open [`AGENTS.md`](AGENTS.md) and confirm commands match your Rust workflow.
2. Confirm Cursor/Claude rules exist under `.cursor/rules/` and `.claude/rules/`.
3. Start an agent session; it should read `AGENTS.md` first, then route tasks via [`factory/skills/factory-router/SKILL.md`](factory/skills/factory-router/SKILL.md).

---

## Step 9 — Optional capabilities (after core install)

Enable only what you need. None of these block step 7 unless config requires a path that is missing.

| Feature | Config / command | Notes |
|--------|-------------------|--------|
| **Agent memory** | `tools.memory: true`, `paths.memory` | Session reads `factory/memory/MEMORY.md` when enabled; memory may be its own git data |
| **Graphify code map** | `tools.graphify: true`, graphify `paths.*` | Run `python3 -B factory/graphify_obsidian.py refresh` when you want notes exported; not part of install |
| **Firecrawl** | `tools.firecrawl: true` | Install and authenticate the Firecrawl CLI separately; skills link only when enabled |
| **Agent Console** | `paths.agent_console_prompts`, `commands.agent_console_setup` | Node.js + Claude ACP; run setup command explicitly when you opt in |
| **Reducto PDF ingest** | `paths.knowledge_base` | `pip install reductoai==0.24.0` and `REDUCTO_API_KEY` in the environment for live parse; see [`factory/README.md`](factory/README.md) |

---

## Step 10 — Verification (recommended)

**Factory kit tests:**

```bash
python3 -m unittest discover -s factory/tests -p 'test_*.py'
```

**Product gates** (after Rust code is present): use the commands in [`AGENTS.md`](AGENTS.md) (`cargo check`, `clippy`, `fmt`, tests). Install does not run them.

**Runtime / integration behavior** is defined in [`factory/profile/testing.md`](factory/profile/testing.md). Execute a profile testing journey with an agent and record evidence separately; `check` and `install` do not substitute for that.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `missing factory/profile/` or `UNFILLED` | Finish profile from `factory/profile/example/` |
| Obsidian vault error | Create vault dir and `README.md`, or clear `paths.obsidian_vault` |
| Knowledge base error | Create KB root + `INDEX.md`, or remove `paths.knowledge_base` / local override |
| `Install stopped because setup requirements are incomplete` | Run `python3 factory/cli.py check` and fix all errors |
| Edited `AGENTS.md` but changes vanished | Edit `factory/config.yaml` and re-run install |
| Skills or rules stale | Re-run `python3 factory/cli.py install` |

---

## Quick reference (cosmos-engine, happy path)

```bash
cd /path/to/cosmos_engine
# ensure factory/ kit is present
python3 -m pip install -r factory/requirements.txt
# optional: factory/config.local.yaml for paths.knowledge_base
python3 factory/cli.py check
python3 factory/cli.py install
python3 -m unittest factory/test_install.py
```

For method details, workflows (design → BINDING → tickets), and adoption in other repositories, see [`factory/README.md`](factory/README.md).
