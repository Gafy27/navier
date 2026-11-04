# Google Rust style (reference)

Canonical guide (read on the web, do not vendor into this repo):

[Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html)

That guide covers more than formatting: module layout, imports, public API
shape, traits, naming, and implementation habits. It explicitly builds on
the public [Rust Style Guide](https://doc.rust-lang.org/nightly/style-guide/)
(rustfmt) and [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).

This file only records how the Cosmos Engine Rust stack uses it.

## Authority

When sources disagree, follow the adopting repo `AGENTS.md` order. In practice:

1. Product contract and BINDING designs
2. This pack: `code-style.md`, `comments.md`, `gjengset.md`
3. This mapping file
4. The Google guide and the public API guidelines it cites

## Use the Google guide for

- Crate and module layout (flat sources, leaf vs non-leaf modules, file names)
- Import hygiene (no `use *`, one module per `use`, qualified top-level calls)
- Library vs application API rules (context section in the guide)
- Function signatures: borrows vs owned, `Into`, iterators vs slices/collections
- Types: newtypes vs aliases, named fields, `#[non_exhaustive]`, `#[must_use]`
- Traits: `derive` when possible, standard traits vs bespoke methods, generics vs `dyn`
- Naming (methods, lifetimes, type parameters, avoiding abbreviations)
- Macros, `unsafe`, and accessor patterns where they match this codebase

Formatting is enforced with `cargo fmt`; see
[`skills/rust-skills/rules/lint-rustfmt-check.md`](skills/rust-skills/rules/lint-rustfmt-check.md).

For task-level lint and error rules, load
[`skills/rust-skills/SKILL.md`](skills/rust-skills/SKILL.md) on demand instead of
re-reading the whole Google guide.

## Local docs supersede the Google guide

| Topic | Local law |
|-------|-----------|
| Comments and rustdoc | [`comments.md`](comments.md) and kit `policy/comments.md` (one-line shape) |
| Async, threads, runtime | [`implementation.md`](implementation.md), [`skills/fast-tokio/`](skills/fast-tokio/SKILL.md), [`skills/rust-async-patterns/`](skills/rust-async-patterns/SKILL.md) — Tokio is in scope; ignore Google **[chrome]** rules that forbid `async`/`.await` or std threads |
| Fuchsia-only rules | Not applicable (e.g. `fuchsia_sync::Mutex`) |
| Short product-facing limits | [`code-style.md`](code-style.md) (e.g. function name length, magic constants) |
| Language taste when skills disagree | [`gjengset.md`](gjengset.md) |

## Complements (read together, not replacements)

| Local file | Relationship to the Google guide |
|------------|----------------------------------|
| [`code-style.md`](code-style.md) | **Does not replace** the guide. Keeps a small set of repo non-negotiables; the Google guide is the deep reference for layout, imports, and public API design on the same themes (enums over bool, newtypes, readable control flow). |
| [`comments.md`](comments.md) | **Stricter** than the guide’s documentation section; wins on comment shape and length. |
| [`gjengset.md`](gjengset.md) | **Complements** API/ownership taste; prefer when the guide is generic or conflicts with *Rust for Rustaceans* idioms. |
| [`skills/rust-skills/`](skills/rust-skills/SKILL.md) | **Complements** with granular, Clippy-aligned rules; many rules cite the same API Guidelines the Google doc follows. |
| [`skills/rust-best-practices/`](skills/rust-best-practices/SKILL.md) | **Complements** with everyday idioms, tooling, and chapter-length explanations. |
| [`skills/rust-patterns/`](skills/rust-patterns/SKILL.md) | **Complements** on crate structure, traits, and concurrency patterns. |
| [`testing.md`](testing.md) | **Complements** test fences and live vs unit policy; follow “right test framework” in the guide only where it matches this pack. |

Nothing in this stack is **replaced** by the Google guide: it is an external
depth reference. `code-style.md` stays the path named in `paths.standards` /
`AGENTS.md`; link here when you need API or module-layout detail.
