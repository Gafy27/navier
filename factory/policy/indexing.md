# Indexing

How the project researches reference codebases and writes index notes.

**Cosmos gold (the method):** one **router README** plus one **SESSION file**
next to the unit, not a flat dump under `paths.index_root`.

| What | Where |
|------|-------|
| Method templates (page order, note skeleton, SESSION skeleton) | `paths.index_pattern`, `paths.index_template`, `paths.index_sessions_template` |
| Live notes, router, next SESSION blocks | `<paths.designs>/<unit>/indexing/` — README is the runbook; `INDEXING_SESSIONS.md` is paste-ready blocks |
| Reference checkouts | `paths.reference_trees` |

**First action:** read the skill `indexing`, then `paths.index_pattern`, then
copy `paths.index_template`. Do not start from a blank page. Do not browse
`paths.reference_trees` cold. For prose and equations in notes, follow
[`markdown.md`](markdown.md).

This is **not** a binding design ([`design.md`](design.md)) and **not** code
work. A note explains its findings and makes a research recommendation, not
a ticket list or an approved design. Technical references follow the recommendation.

## Session (like tickets)

Paste **one** SESSION block into a **new** chat. One note per session; never
resume the previous indexing chat. Copy the skeleton from
`paths.index_sessions_template`. The unit's `indexing/INDEXING_SESSIONS.md` is
the filled queue.

Every session inherits:

1. **One question, one recommendation, one file.** Follow the page order in
   `paths.index_pattern`: answer and relevance first, explanation and evidence
   next, then limitations and recommendation, with technical references last.
   The reader should understand the result before reading a source map.
2. **The unit indexing README is a hot file.** Re-read it before editing.
   Register the note with a **single anchored edit**. Never rewrite it wholesale.
3. **Do not design or write product code.** Do not clone a tree unless the
   SESSION names the clone.
4. **Locked defaults in that README are law.** Do not reverse them. New product
   locks go through [`decisions.md`](decisions.md).
5. **Live web is required** on write or revise for anything without a local pin
   ([`firecrawl.md`](firecrawl.md), when `tools.firecrawl`). A blog is never the
   contract; a merged PR supersedes an issue opener; local `path:line` still
   wins.

If the README already points at a note that answers the question, stop: extend
it or add a See-also. Do not write a twin.

## Index router (the runbook)

A unit that is still indexing looks like this. Minimum:

| Section | Why |
|---------|-----|
| Objective | One product sentence |
| Exit criteria | What an agent can do from the map alone |
| Locked defaults | Product cuts; dated; a design may amend, this file must not reverse |
| Open research | Gaps, not ticket numbers |
| Entrypoints + reading order | Do not walk the folder listing |
| Research order | Live web vs local pin |
| Notes table | One row per note; register in the same change |
| `INDEXING_SESSIONS.md` | One paste-ready block per next note |

Do not write a binding design from the router. Do not start product code from it.
Which trees to index: `<paths.profile>/skills.md` or
`<paths.profile>/requirements.md`.

## Research order

Grep the pin first when a checkout exists. Live web second
([`firecrawl.md`](firecrawl.md)). Source wins.

**With a local pin** under `paths.reference_trees`:

1. `graphify query` ([`graphify.md`](graphify.md)) if `tools.graphify` and the
   graph exists — use `commands.graphify_*` on `paths.graphify_graph` (product
   code), not the bibliography graph.
2. `rg` under the paths the router names; rank P0 by references.

**Bibliography** (`bibliografia/` books, papers, investigation notes): the
`research` agent runs `commands.bibliografia_graphify_*` on
`paths.bibliografia_graphify_graph` before wide `rg` under `bibliografia/`.
Same navigation-only rule as [`graphify.md`](graphify.md); sources cited in the
note still win on conflict.
3. The developer index for what grep cannot see: intent, bugs, option contracts.
4. Open only P0, as slices ([`reading.md`](reading.md)). Cite `path:line`.

**Without a local pin:**

1. Search the developer index first, **unscoped**, all four `types`; raise
   `passages` before `k`.
2. **Scope last.** If `repos` or `sources` echo `indexed: false`, drop the scope.
3. **Scrape** the hit `url` when the passage is the wrong slice.
4. Use the open web only when the index has nothing.
5. Then any local pin. Checkout **wins** on conflict.

Do not crawl docs trees into a local folder as the map. Do not ship a workflow
report as the note. The note stays `paths.index_template`.

When `tools.caveman`, wrap Firecrawl / REA / graphify / `cargo tree` dumps
likely > ~400 lines (`caveman tools shrink -- …`). Notes stay kit English.

**REA** ([`rea.md`](rea.md), when `tools.rea`): optional for any question,
required when the SESSION says `REA: required`. Use it for what neither a
pin nor the web shows: a closed product's live wire, its front-end code, or
a shipped binary. Run it after the steps above. A pin still wins on
conflict. Driving a browser needs `REA scratch:` in the SESSION.

## After the note

1. Status stays `draft` until the note explains the answer and relevance,
   supports them with evidence, and qualifies its recommendation. Apply the
   reader-understanding and evidence criteria in `paths.index_pattern` before
   marking it `ready`. Headings alone do not satisfy that bar.
2. Add the router row in the same change.
3. If the decision would lock a **gate** ([`decisions.md`](decisions.md)), stop
   and ask before it goes into the product contract or the router's locked
   defaults.
4. Never mark a design BINDING from an index.
