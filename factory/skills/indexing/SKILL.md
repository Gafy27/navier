---
name: indexing
description: >
  Research a reference codebase or documents into one source-cited index note.
  Use for indexing, re-indexing, module notes, or a codebase map. Read-only
  explanations without a note: parent explores with graphify; binding specs belong
  to design-docs.
---

# Indexing

Own a cited answer to one question that the user can understand. Explain the
answer and relevance before technical detail; evidence precedes the research
recommendation. This skill owns execution; `research` owns the note and router edit.

## Read

Resolve keys from the kit config. Read `policy/indexing.md`,
`policy/reading.md`, `paths.index_pattern`, `paths.index_template`, and the
session's router. Those files own research order, source authority, page
shape, and ready criteria. Do not copy their rules into another checklist.

## Workflow

1. Fix the Question to the router's objective. Check for an existing answer before opening source.
2. Gather evidence in `policy/indexing.md`'s pin/no-pin order. Use the configured graph when applicable, then only relevant source slices. Load the matching evidence skill when needed.
3. Trace the mechanism from P0. Cite `path:line`; distinguish source observations, inference, and unknowns. Code behavior alone does not establish author intent.
4. Write from `paths.index_template` in its required order. Draft the plain-language answer after gathering evidence and place it first. Explain relevance and one concrete example; keep source maps and any Model in Technical references.
5. Check citations and the owning pattern's ready criteria. Re-read the router and register the note with one anchored edit in the same change.

## Evidence tools

Load `firecrawl` and the matching child only when `tools.firecrawl` is
enabled and the research policy requires web evidence. `policy/firecrawl.md`
owns routing, scope recovery, and source hierarchy; command skills own CLI
syntax. A developer question does not require a paper search or a broad
workflow run. Do not invent HTTP fallbacks.

Load `rea` only when enabled and applicable or explicitly required by the
session. Follow `policy/rea.md` for target authorization, scratch boundaries,
and retained evidence. Tool output is evidence, not the product map.

## Stop conditions

- An existing note answers the Question: name it and propose an extension or See-also; do not create a twin.
- Required source or tool is inaccessible: name the attempted source and gap. Keep unsupported conclusions unverified; do not invent evidence.
- A decision would change a product lock: return the gate under `policy/decisions.md`. An index never marks a design BINDING.
- The note and its router row meet the owning pattern's ready criteria: return the handoff; do not start design or implementation.

## Reply contract

Report `Note`, `Decision`, and `Unverified or blocked` in that order. `Note`
includes the path and a brief plain-language answer with its relevance.
`Decision` states the research recommendation with its evidence location, not
a product approval. Name unresolved gaps (or none).
For missing input or a duplicate answer, use `not created` and name the
missing input or existing note. Keep the handoff brief; do not repeat the full
note in chat.

Examples: [examples.md](examples.md). Bindings: `<paths.profile>/skills.md`.
