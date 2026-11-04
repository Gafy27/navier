# Skill bindings (this project)

Language pack: [`../stack/rust/skills.md`](../stack/rust/skills.md). Load only
the skill the change touches.

## Stack skills (host)

Project test selection and real-behavior journeys live in
[`testing.md`](testing.md), which directly contains the project recipes. Keep product test rules there.

| Skill | Use when |
|-------|----------|
| `rust-skills/` | Default. Then only `rules/<id>.md` this change needs |
| `rust-patterns/` | Crate layout, traits, concurrency |
| `rust-best-practices/` | Clippy, `Result`, everyday idioms |
| `rust-async-patterns/` | Tokio channels, cancellation idioms |
| `fast-tokio/` | **MUST** when design or code uses Tokio runtime |

## Untrusted input

SQL, org documents, user Python, wire payloads, env. Parsed once at the
boundary into a dedicated type. Code behind the boundary does not validate
again.

## indexing

Notes live under `<paths.designs>/phase-N/indexing/`. Method templates:
`paths.index_pattern`. Reference trees: `paths.reference_trees`. Do not browse
`inspiration/` cold. Phase trees: 0–2 RisingWave; 3 DataFusion; 4 lakehouse
indexes; 5 query serving.

`python-engine/` is archaeology, not a tree to index unless the SESSION names it.

## graphify / firecrawl

| Skill | Use when |
|-------|----------|
| `graphify/` | Before exploring crate code (`tools.graphify`) |
| `firecrawl/` then `firecrawl-*` | Live web, library docs, papers (`tools.firecrawl`) |
| `rea/` | Closed web apps, shipped binaries, HAR captures (`tools.rea`) |
| `ponytail*` | Official 5.2.0, verbatim. Write: `ponytail` `full`. Last ticket: `ultra`. Review: `ponytail-review`. Audit/debt/gain/help: human only |
| `caveman/`, `ultracave/`, `megacave/` | Official voice, verbatim (`tools.caveman`); CLI shrink in `policy/caveman.md` |
