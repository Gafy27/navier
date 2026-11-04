# Firecrawl

When `tools.firecrawl` is true in `config.yaml`: any live-web research, library / API /
error / bug lookup, paper search, or sourced research report. **Read the matching
skill before acting.** Do not invent curl when a skill names the CLI or MCP surface.

This is **not** the indexing note shape ([`indexing.md`](indexing.md),
`paths.index_template`). Firecrawl gathers evidence. Local `path:line`
still wins.

## Route first

| Need | Load |
|------|------|
| Ordinary web search / scrape / map / crawl / interact / monitor | `firecrawl` (router), then the command skill |
| Library, API, error, known-bug from issues / PRs / READMEs / docs | `firecrawl-developer-index` — `firecrawl developer` |
| Biomedical / clinical / scientific literature | `firecrawl-research-index` — `firecrawl research` |
| Sourced research report or literature review | `firecrawl-workflows`, then `firecrawl-deep-research` or `firecrawl-research-papers` |

Indexes beat the open web for primary-source coding questions. A merged
PR supersedes an issue opening report. Checkout `path:line` supersedes
both when a local pin exists.

`search --categories developer` is not the developer index.
`search --categories research` is not the paper index.

## Laws

1. Load the skill. Then run the CLI (or MCP). No homemade HTTP recipes
   unless the skill names that fallback.
2. **Scope last.** If `repos` / `sources` echo `indexed: false`, drop the
   scope — do not retry the same filter.
3. `repos` + `sources` **union**. Repository filters (`language`,
   `min_stars`) drop `doc` unless `sources` is also set.
4. Never answer from an issue opener. The merged PR is current behaviour.
5. Developer search does not scrape. Follow through with a second
   `firecrawl scrape <url>` when the passage is the wrong slice
   (firecrawl/firecrawl#4373).
6. Do not crawl docs trees into `.firecrawl/` as the product map.
   Workflows / `.firecrawl/` corpora are evidence, not the note.
7. When `tools.caveman`, wrap Firecrawl CLI dumps likely > ~400 lines:
   `caveman tools shrink -- firecrawl …` ([`caveman.md`](caveman.md)).

## Indexing

Required on write/revise of notes under `<paths.designs>/<unit>/indexing/`
(skip only for README-only edits or a synthesis that adds no new source claim).

Pin vs no-pin order lives in [`indexing.md`](indexing.md). Skill map:
`firecrawl.md` under `paths.index_root`, if the project keeps one.
The note stays `paths.index_template`.

| Question kind | `types` | Extra |
|---------------|---------|--------|
| Why / known bug | `issue`, `pull_request` | then re-query with `types:["pull_request"]` |
| Literal error / stack | `issue`, `pull_request` | search the string + library |
| SQL / option / default | `readme`, `doc` | follow with `pull_request` if the contract moved |
| How do I do X | all four | raise `passages` before `k` |
| Version-specific | `issue`, `pull_request` | read resolution + linked PR, not the opener |

Developer first, **unscoped**, when there is no local pin. Grep the pin
first when a local checkout exists under `paths.reference_trees`.

## Install

Skills ship in this kit (`factory/skills/firecrawl*`). Copy or symlink them into
`.agents/skills/` on adopt. The **CLI** is still a machine install:

```
firecrawl setup core -g -y
firecrawl setup workflows -g -y
firecrawl --status
```
