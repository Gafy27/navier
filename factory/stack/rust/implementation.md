# Implementation (Rust)

When the work **writes, reviews, or refactors Rust**. Kit method:
`policy/implementation.md` (graphify, secure-code four, after-diff reviewers).
This file is the Rust skill map. Product crate map: adopting repo
`<paths.profile>/layering.md`.

## External style reference

Public API and module layout:
[`google-rust-style.md`](google-rust-style.md). Local `comments.md`, Tokio
skills, and `gjengset.md` win where the Google guide conflicts (see that file).

## Rust skills (on demand)

Do not preload full catalogs. Start with
[`skills/rust-skills/SKILL.md`](skills/rust-skills/SKILL.md); load individual
`rules/<rule-id>.md` for the task.

| Skill | Use when |
|-------|----------|
| `rust-skills/` | Default guidelines |
| `rust-patterns/` | Crate layout, traits, concurrency |
| `rust-best-practices/` | Everyday idioms, Clippy, Result |
| `rust-async-patterns/` | Tokio channels, cancellation (idioms) |
| `fast-tokio/` | **MUST** when design/code uses Tokio — runtime fairness, batching, locks |

Keep diffs minimal. Match existing crate conventions.

## Fast Tokio (MUST when Tokio is in play)

If the work uses Tokio (`spawn`, `spawn_blocking`, `select!` / `JoinSet`,
async mutexes, multi-runtime, executor fairness), read
[`skills/fast-tokio/SKILL.md`](skills/fast-tokio/SKILL.md) before implementing
or locking the design.

That skill is measure-first runtime performance (dial9), not channel idioms.
Idioms stay on `rust-async-patterns`.

## Jon Gjengset

[`gjengset.md`](gjengset.md). Prefer his idioms when skills disagree on
language/API design. Product scope stays on the adopting repo's
`<paths.profile>/requirements.md`.
