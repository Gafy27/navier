# Indexing pattern

Readable research notes with source maps for humans and agents. **Do not browse a reference
tree cold.** Start at the index router (`paths.index_root` README), then open only
cited paths. Copy `INDEX_NOTE.md`; do not start from a blank page.

An index explains a useful finding and what the project can learn from it.
Keep a curated source map, not a tree inventory. If the finding cannot inform
the current objective, do not write a separate note.

Binding project designs live in `paths.designs` and **win** over any note. This
file governs index notes only. Markdown and math formatting:
[`policy/markdown.md`](../policy/markdown.md) (Obsidian / KaTeX; use `$$` for
display math, not `\[` `\]`).

## Page order

Question → Answer in plain language → Why it matters for this project →
How it works → Key findings and evidence → Limits and unknowns →
Research recommendation → Technical references.

The opening answers the research question; it does not approve adoption or
change a product lock. Explain relevance early. Put the adoption recommendation
after its evidence and limitations. File maps, signatures, source versions,
and related notes support the explanation from the final reference section.

| Reader needs | Read |
|--------------|------|
| Understand the answer and its relevance | Question, Answer, Why it matters |
| Understand the mechanism | How it works, including a concrete example |
| Judge support and confidence | Key findings and evidence, Limits and unknowns |
| Compare proposed actions | Research recommendation |
| Verify or implement later | Technical references and cited sources |

New notes and revised notes use this shape. Do not rewrite untouched notes
solely to change headings. Preserve evidence and qualifications during a revision.

## One note, one question, one recommendation

One significant recommendation per file. Two distinct rulings need two linked notes. Past
~400 lines, split into linked notes and update the router; length is a trigger,
not a hard reject. Filename: `<project>-<topic>.md`, unique in the index.

## When not to write

- The router already points at a note that answers the question. Extend it or add a
  See-also; do not write a twin.
- The finding does not change adopt / adapt / ignore / reimplement / drop.
- You are re-indexing something the objective has closed.

Archive or delete dead notes; do not leave them on the critical path.

## Research order

1. **Objective.** The router names it. Extract only what answers it.
2. **Local design docs** of the reference tree, if any, before grepping. Cite them
   for vocabulary and source for behavior. On conflict, **source wins**; say so.
3. **Graph, then grep.** Run the code graph (`policy/graphify.md`) if present, then
   grep under the router's paths. Rank P0 by what other code references, not by
   the order you opened files.
4. **Live web** (`policy/firecrawl.md`) after local ranking, for intent, traps, and
   option contracts: issues, merged PRs, docs. A merged PR supersedes an issue
   opener; the checkout supersedes both. Skip only for a router-only edit or a
   synthesis that adds no new source claim.
   **REA** (`policy/rea.md`, when `tools.rea`) for a closed product's live wire,
   front-end code, or shipped binary. Optional; required when the SESSION says
   `REA: required`. Cite the Evidence ID.
5. Open only P0. Cite `path:line`. Relevant signatures go in the reference Model, not bodies.
6. Write the note. Draft the plain-language answer after gathering evidence; place it first on the page.
7. Register it in the router **in the same change**, with one anchored edit.
8. Stop when the objective has a concrete answer, or "N/A — why".

## Writing for understanding

The template owns the detailed section prompts. Each part has a different job:
the answer states the result, relevance explains its consequence, the example
teaches the mechanism, and findings establish the evidence. Do not repeat the
same account in three forms to fill headings.

Use short, connected paragraphs and familiar words. Define unfamiliar terms
before relying on them. Introduce an operation's job before its internal name.
Lead with what happens and why it matters, then explain the detail that makes
it true. Neither brevity nor citations excuse an unexplained technical claim.

A small example should let the reader predict a result. It may be hypothetical,
but label it as an illustration and distinguish it from a scenario actually
executed. Add a diagram only when it clarifies a relationship or sequence.

Cite each behavior claim with `path:line` or the appropriate external source.
Keep source pointers beside the supported claim without making every sentence
a file inventory. Opening summaries may link to the precise findings below.
Distinguish observations, documented contracts, and inference. Put important
qualifications beside the affected claim as well as in Limits and unknowns.

Project relevance is welcome in the opening and explanation. Support it with
the router objective and actual project constraints. Do not invent a project
requirement, author intent, or approval to make a finding sound useful.

## Research recommendation

Give one significant recommendation: adopt, adapt, ignore, reimplement, or drop.
Explain the proposed action in ordinary language, not just the category. Tie
it to the evidence, alternatives, practical costs, and unresolved questions.
Keep it before the technical appendix so readers need not traverse a file map
to understand what the research suggests.

The recommendation is research advice, not an approved design, dependency,
schema, or implementation task. Product locks still follow `policy/decisions.md`.
Do not silently rewrite a `ready` ruling: add a note that supersedes it and
link both ways. A presentation-only revision may improve the explanation while
preserving the ruling, evidence, and scope.

## Technical references

Keep the ranked P0/P1/Skip map and any useful Model here. A Model contains
signatures and types, not function bodies; omit it when the sources do not
have a relevant code interface. Do not fill empty subsections with ceremony.
State local path bases and relevant checkout pins or retrieval dates. Link
source documentation for vocabulary, but cite inspected source for behavior
and explain conflicts beside the affected finding. Local source authority and
research order remain unchanged.

## Quality bar

A ready note lets the user explain the answer, its relevance, and an example
without reading source code or the technical references. It supplies precise
evidence, states limitations honestly, and distinguishes recommendations from
approved decisions. P0 is ranked, plausible rejected options are explained,
and the router is updated in the same change.

Do not declare `ready` merely because every heading exists. Check that the
example follows the stated behavior, key findings support the answer, and any
unverified claim remains qualified. Do not index every file, invent patterns,
copy implementations, or duplicate a BINDING design.

## Router row

```markdown
| File | Area | Concerns | Status |
|------|------|----------|--------|
| [shutdown.md](shutdown.md) | one-line description, not the filename | lifetime | ready |
```

Status: `draft` | `ready` | `seed` (legacy dump still to split) | `superseded`.
