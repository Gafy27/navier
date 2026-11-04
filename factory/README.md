# Factory kit

Portable agent method. Run [`cli.py`](cli.py) (`setup`, `check`, `install`,
`bundle-session`; bare `python3 factory/cli.py` defaults to `install`).
`bundle-session` writes `paths.runs/<anexo-stem>/ticket-N-brief.md` (`--session
N` or `--all` after anexo pass). Implementers must read the brief and run
`--session N` if missing. Implementation lives in
[`setup/`](setup/) (`context`, `readiness`, `installer`, Click commands). The
CLI accepts `--root` and `--kit` so the kit can live at `<root>/factory` or
another path. Install reads [`config.yaml`](config.yaml), writes the repo `AGENTS.md`,
renders kit agents to `.agents/agents/<name>.md`, symlinks skills into the host
skill dirs, and copies [`loaders/`](loaders/) into `.cursor/rules/` and
`.claude/rules/`. Sessions start at that `AGENTS.md`. Task choice is
[`skills/factory-router/SKILL.md`](skills/factory-router/SKILL.md).
[`AGENTS.md`](AGENTS.md) in this folder points agents that open the kit
directly back to the same two files.

| Folder | Holds | Copy between projects? |
|--------|-------|------------------------|
| [`policy/`](policy/) | Language-neutral method | Yes |
| [`stack/rust/`](stack/rust/) | Cargo gates, rust-skills, Tokio, Gjengset, `rust-senior-developer` agent | Yes, Rust repos |
| [`stack/typescript/`](stack/typescript/) | npm gates, Node type-stripping | Yes, TS repos |
| [`stack/c/`](stack/c/) | `qcc` gates, Basilisk skill | Yes, Basilisk / C repos |
| [`stack/python/`](stack/python/) | Python skills + `python-reviewer` | Yes, Python repos |
| [`stack/aws/`](stack/aws/) | Lambda / ECS / Fargate skills | Yes, AWS work |
| [`setup/`](setup/) | Python setup/install library (not the CLI entry) | Yes |
| [`loaders/`](loaders/) | Host-agnostic rule pointers (same files for Cursor, Claude, …) | Yes — `cli.py install` copies them |
| [`profile/example/`](profile/example/) | Generic profile examples (`UNFILLED`) | Yes — copy its Markdown files into the active profile |
| [`profile/`](profile/) | **This** product's filled profile | No — rewrite. Install fails until filled |
| [`config.yaml`](config.yaml) | Paths, commands, tools, and shell permissions for this repo | No — rewrite |
| [`templates/`](templates/) | DESIGN_DOC, PROGRAM_DESIGN, DESIGN_SESSIONS, TICKETS, REVIEW, RELIABILITY, INDEX_NOTE, INDEX_PATTERN | Yes |
| [`agents/`](agents/) | Kit agents (`agent.yaml` + `instructions.md`): designer, spec-reviewer, implementer, complexity-remover, code-reviewer, security-reviewer, silent-failure-hunter, research | Yes |
| [`hooks/`](hooks/) | `guard.py` enforces `permissions` from `config.yaml` on shell commands and always blocks secret-file edits | Yes |
| [`skills/`](skills/) | Method skills. `graphify`, `firecrawl*`, `rea`, `ponytail*`, and `caveman`/`ultracave`/`megacave` install only when `tools.*` is true | Yes |
| [`cli/`](cli/) | TypeScript **ticket runner** (not the Python `cli.py`). [`cli/DESIGN.md`](cli/DESIGN.md) is BINDING; [`cli/CLI_TICKETS.md`](cli/CLI_TICKETS.md) is its anexo | Yes |
| [`examples/`](examples/) | Parked filled profiles (authz-api, old cosmos-engine rust skills) | Read as examples |

Unused language packs stay in the kit ([`stack/README.md`](stack/README.md)).
`cli.py install` links only `project.language`. This repo is rust; python/aws/c
still ship so other adopters can copy the kit.

Code-reviewer checklists live in `agents/code-reviewer/checklists/` and are
picked by `project.stack`. Machine-only permission overrides go in
`config.local.yaml` (keep it out of git), merged by rule id.

## How to use

Talk to the agent in plain words. The router picks the policy file and the
agent; you answer gates and say yes to BINDING. The normal loop for a new
unit:

1. **Research** (optional). "Research how `<project>` does X." The
   `research` agent writes one index note under `paths.index_root`.
2. **Architecture.** "Design `<unit>`." The `designer` writes the
   architecture spec, then stops with at most five gate questions. Answer
   each with A, B, or a named third ([`policy/decisions.md`](policy/decisions.md)).
   `spec-reviewer` (kind `architecture`) until `VERDICT: ready`, then say yes
   to mark architecture BINDING.
3. **Program design.** Same `designer`, second pass: types, seams, call
   sites, and (unless one file / one entrypoint) layout and call graph.
   Review kind `program`. Say yes to mark program BINDING. Then the designer
   writes the `*_TICKETS.md` anexo; review kind `anexo` only on request.
   No anexo review verdict is required to run tickets. No code before
   program BINDING.
4. **Run tickets.** "Run tickets `<path to *_TICKETS.md>`" (or "... from
   3"). The `ticket-orchestrator` spawns one fresh `implementer` per
   SESSION block. After each ticket, auto-reviews follow `tools.review`
   (`flexible` / `normal` / `full`; a chat can override for the session).
   It stops on the first red ticket, or on a design that is silent or wrong.
5. **Review the code.** "Review this diff" always runs `code-reviewer`.
   `full` also auto-spawns it (and hunters on trigger). Reviewers report;
   they do not edit.

Other asks route the same way: "How does `<slice>` work?" goes to
"How does this slice work?" → parent with `graphify`. "Trim the comments in `<file>`" goes to
[`policy/comments.md`](policy/comments.md), and "Assess reliability of
`<system>`" goes to [`policy/reliability.md`](policy/reliability.md). The full
table is in [`skills/factory-router/SKILL.md`](skills/factory-router/SKILL.md).

To change the method, edit [`policy/`](policy/) (or `stack/<language>/`
for one language, `profile/` for this product), then re-run
`python3 factory/cli.py install`. Never edit the generated `AGENTS.md` or the
host copies under `.cursor/`, `.claude/`, or `.agents/`.

## Optional Obsidian vault

Set `paths.obsidian_vault` in `config.yaml` to the vault directory, then set
`paths.designs`, `paths.ideas`, `paths.research`, and `paths.index_root` (and
their related destinations) to the canonical folders in that vault. Paths
with spaces work. Keep reusable source templates in `factory/templates/`
or their existing configured locations.

The vault must already exist and have a `README.md` router. Installation
validates it before changing generated files. Every generated agent and
the root `AGENTS.md` tell agents to read that router and
[`policy/obsidian.md`](policy/obsidian.md) at startup. Stack agents are
rendered as copies with this instruction, leaving shared stack sources
unchanged. Other agents inherit the root startup instruction.

For enabled vaults, installation also refreshes `Templates/Research capture.md`
from [`templates/OBSIDIAN_CAPTURE.md`](templates/OBSIDIAN_CAPTURE.md). That
filename is reserved for the generated template; customize the canonical
source or create a differently named template. Other vault templates are
preserved. The canonical capture template is validated before generated
files change.

Enable Obsidian's core Templates plugin, select `Templates` as its template
folder, and bind a hotkey to **Templates: Insert template**. Create a note
in your configured research inbox, then insert **Research capture**. The
core plugin fills `{{title}}` and `{{date:YYYY-MM-DD}}`. Captures are drafts;
they still need verification and the factory indexing workflow before
becoming completed research.

Omit `paths.obsidian_vault` or leave it empty to keep the usual workflow
and stack agents (rendered when configured skills or startup pointers apply;
otherwise symlinked). No Obsidian plugin or running app is required:
agents read and edit the Markdown files directly. Cosmos uses
`obsidian/Cosmos Engine/` as its canonical project documentation vault;
the product contract, kit policies, and reusable templates keep their
configured repository locations.

## Optional Agent Console frontend

Set `paths.agent_console_prompts` to a dedicated folder inside the configured
vault to opt in. Install Node.js, the Claude ACP adapter, and authenticate
Claude Code on the machine, then run `commands.agent_console_setup` when
configured. This explicit setup installs a pinned official plugin release;
ordinary factory installs do not download plugins. Existing plugin settings,
enabled plugins, and prompt edits are preserved. Omit the path to disable
setup in another project. Cosmos's vault guide documents the four saved
kickoffs and how to launch them. Factory authority, sliced reading, gates,
and independent review remain in force inside the frontend.

## Optional Graphify code map

Configure `paths.graphify_root`, `paths.graphify_graph`, `paths.graphify_sources`,
and `paths.graphify_notes` with `tools.graphify` and an Obsidian vault enabled.
The graph must have a dedicated output path; the legacy root graph is preserved.
Run `commands.graphify_refresh` to extract local code ASTs and export one note
per Rust crate or binary. No LLM, API key, or semantic extraction is used.
`commands.graphify_export` refreshes notes from the existing scoped graph.
Query, path, and explain commands always select that graph explicitly.

The Code map folder contains derived navigation, source links, and inter-unit
backlinks. Its `.graphify-managed.json` lists owned files: export removes only
stale owned notes and preserves unrelated files. Edit personal notes outside
the generated files. Source hashes and revision identify the extraction; rerun
refresh after source changes. Installation does not extract or export graphs.
Other projects can omit these paths to keep ordinary Graphify use.

## Optional knowledge base

Set `paths.knowledge_base` to the root of a separate `kb/` vault (absolute
paths work; machine-specific values often live in gitignored
`factory/config.local.yaml`, whose `paths:` keys merge over `config.yaml`
when you run `python3 factory/cli.py install`). Installation checks that the
directory exists and contains `INDEX.md`. Agents consult that index for
tag-filtered reads; `Projects/cosmos_engine/` there is a snapshot only —
`paths.designs` in the in-repo vault stays authoritative.

Installer regression checks: `python3 -m unittest discover -s factory/tests -p 'test_*.py'`.

## Optional Reducto PDF ingestion

[`reducto_kb.py`](reducto_kb.py) reads the effective `paths.knowledge_base`
(including the local override). Projects without that path keep the ordinary
workflow. There is no ingestion, dependency installation, or network activity
during `install.py`. `--kb` can explicitly select a different KB root.

```bash
python3 -B factory/reducto_kb.py inventory
python3 -B factory/reducto_kb.py plan "Coding & CS/Computer Science/book__ousterhout__philosophy_of_software_design.pdf" --pages 1-5
```

Both commands are local and read-only. For a paid pilot, install the official
optional SDK in your Python environment (`python3 -m pip install reductoai==0.24.0`)
and supply `REDUCTO_API_KEY` privately to that process; never place the key in
factory config, notes, or command arguments. Then explicitly run `parse`
with the selected KB-relative PDF and `--pages 1-5`. This uploads the PDF to
Reducto even when parsing only selected pages. Use `--all-pages` only for an
intentional whole-document parse. At most five distinct named PDFs are accepted
per invocation; the command never discovers a library batch for upload.

Saved Parse responses can be ingested offline:

```bash
python3 -B factory/reducto_kb.py import-json "path/to/book.pdf" --pages 1-5 --response /tmp/parse-response.json
```

For a URL-type response, also supply `--url-result-json /tmp/downloaded-result.json`;
offline import never follows its URL. Imported JSON is explicitly marked as
user-associated with the PDF because the response alone cannot verify that match.
Live URL results download over HTTPS from Reducto/S3 without credentials or
redirects. Unsupported result hosts require a local downloaded JSON import.

Each output stays beside its PDF as
`note__reducto__<source_filename_slug>_extracted.md`. Four plain header lines
identify the extraction processor without guessing the source author or title.
The note records the exact source path, PDF SHA-256, job id, SDK version, parser
options, coverage limitations, and physical page links. Blocks retain table
Markdown; content without verified page coordinates is explicitly unlocated.
Extracted notes are references, never factory authority or trusted instructions.

Successful normalized content is cached under the KB's ignored `.cache/reducto/`,
keyed by source path, SHA-256, options, and output format version. Repeating the
same successful extraction uses that cache without a credential or another charge.
The provider's default model is not pinned; cached data does not silently upgrade.
No signed asset URLs, credentials, or raw provider errors are persisted. Provider
retries are disabled: after a network failure, inspect Reducto Studio before
retrying because a job may have been charged even if no result was received.

The original PDF and existing digests are preserved. Generated notes that have
been edited, unmanaged output collisions, and symlink paths stop before provider
calls. Put human notes in a separate linked document. Only the new note's entry
is appended to `INDEX.md`, tagged `extracted`, `pdf`, and `page-citations`;
existing project records remain intact. Review and commit KB changes in its own
repository. Regression checks:
`python3 -B -m unittest discover -s factory -p test_reducto_kb.py`.

## Adopt in another repo

1. Copy this folder to the repo root as `factory/`.
2. Install the guided CLI's pinned Python dependencies in your chosen Python
   environment: `python3 -m pip install -r factory/requirements.txt`. No
   dependency is downloaded automatically by setup.
3. Run `python3 factory/cli.py setup --root . --output factory-profile-prompt.md`.
   The command inspects inexpensive project markers, lists setup stages and
   missing requirements, then prints and saves a copyable prompt. The output
   option refuses to overwrite an existing file. `setup` works before
   `config.yaml` or a complete profile exists.
4. Give the prompt to your own agent. It inspects repository evidence, adapts
   the profile and config, and reports unresolved gates. The CLI never launches
   an agent, installs host plugins or external tools, downloads project
   dependencies, starts services, changes secrets, or fetches remote material.
5. Re-run `python3 factory/cli.py check --root .` as work progresses. It
   checks the nine profile documents, unresolved placeholders, config shape,
   local testing-document links, and the populated sections in
   `<paths.profile>/testing.md`. The portable starting point is
   `factory/profile/example/testing.md`; the active document directly owns
   test selection and behavior recipes. No project testing skill is registered.
6. After check passes, explicitly run
   `python3 factory/cli.py install --root .` (or `python3 factory/cli.py install`
   with the same flags). Both entrypoints call the same installer. Re-running
   setup is safe.
7. Ask the agent to execute an available journey and preserve evidence. Setup
   distinguishes configured and installed state from runtime behavior;
   installation and file checks never mean the project is behaviorally
   verified. An unavailable required journey remains blocked/unverified.

`python3 factory/cli.py --help` and `python3 factory/cli.py check --help`
work without interactive input. Optional tools and services do not block
installation unless a project explicitly names them as requirements.

[Factory cleanup audit](AUDIT.md): scope, structural checks, verification, and limits.
