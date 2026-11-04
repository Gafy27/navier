---
name: graphify
description: >
  Query the configured project code graph before source exploration when
  tools.graphify is true. Use for architecture, callers, dependencies,
  relationship paths, graph refresh, and generated Obsidian code maps.
allowed-tools:
  - Bash(graphify *)
  - Bash(python3 -B factory/graphify_obsidian.py *)
---

# Graphify

Read `factory/policy/graphify.md`. Resolve the graph and working directory
from `paths.graphify_graph` and `paths.graphify_root` in the factory config.
Do not substitute the old mixed repository graph for a configured project
index. Query first, then read the identified source slices.

## Operations

Use configured commands when present:

| Key | Purpose |
|-----|---------|
| `commands.graphify_query` | Scoped context for a question |
| `commands.graphify_path` | Path between symbols |
| `commands.graphify_explain` | Symbol and neighbors |
| `commands.graphify_refresh` | Local AST refresh and generated note refresh |
| `commands.graphify_export` | Refresh Obsidian notes from the existing graph |

For projects without these command bindings, use installed Graphify
`query`, `path`, or `explain` with the selected graph's `--graph` argument.
A missing graph is an explicit skip; report it. Markdown-only edits do not
require a graph query. Avoid repeating a query that already oriented the
current session.

## Code map

When configured, generated Obsidian notes at `paths.graphify_notes` are
navigation aids with source citations and linked units. They are derived
from the graph, not binding specs. Keep human annotations in separate
notes. After source edits within `paths.graphify_sources`, run the configured
refresh command. It uses AST extraction without an API key.

The upstream full-pipeline reference is `reference.md`. Its optional
export instructions can differ from the installed CLI; check installed
capabilities before invoking them. Use it only for an explicitly requested
full extraction or advanced mode, not for daily refresh/query work.
