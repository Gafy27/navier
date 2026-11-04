<!-- UNFILLED -->
# Skill bindings (this project)

Language pack: `../stack/<project.language>/skills.md` (this example:
[`../../stack/rust/skills.md`](../../stack/rust/skills.md)). Load only the
skill the change touches.

## Stack skills (host)

| Skill | Use when |
|-------|----------|
| language default skill | Default. Then only the rule files this change needs |
| async / runtime skill | **MUST** when design or code uses the process runtime |

## Untrusted input

Wire payloads, documents, SQL, env. Parsed once at the boundary into a
dedicated type. Code behind the boundary does not validate again.

## indexing

Notes live under the phase indexing tree. Method: `paths.index_pattern`.
Reference trees: `paths.reference_trees`. Do not browse inspiration cold.
List which phases map to which source trees.

A deprecated prototype tree is archaeology, not a tree to index unless
the SESSION names it.

## graphify / firecrawl

| Skill | Use when |
|-------|----------|
| `graphify/` | Before exploring unit code (`tools.graphify`) |
| `firecrawl/` then `firecrawl-*` | Live web, library docs, papers (`tools.firecrawl`) |
| `rea/` | Closed web apps, shipped binaries, HAR captures (`tools.rea`) |
| `ponytail*` | Write: `ponytail` `full`. Last ticket: `ultra`. Review: `ponytail-review`. Audit/debt/gain/help: human only |
| `caveman/`, `ultracave/`, `megacave/` | Voice (`tools.caveman`); CLI shrink in `policy/caveman.md` |

Rewrite trees and the untrusted-input list. Delete `<!-- UNFILLED -->`.
