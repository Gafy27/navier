# Rust stack pack

Reusable Rust method for the factory kit. Copy this folder unchanged into
another Rust repo. Project laws (crate map, live services, layout) stay in
`profile/`, not here.

Load when `project.language` is `rust` (see the kit `config.yaml`). Policy
(`factory/policy/`) stays language-neutral. This pack is the next layer.

## Adopt in a new repo

1. Copy `factory/` (or this `stack/rust/` folder) into the project.
2. Set `project.language: rust` and merge [`config.yaml`](config.yaml) into the
   kit `config.yaml` `commands:` block.
3. Copy `skills/*` into `.agents/skills/` (host loaders symlink there).
4. Copy `agents/rust-senior-developer.md` into `.agents/agents/`.
5. Copy [`jon-gjengset-rust.md`](../../loaders/jon-gjengset-rust.md) and
   [`fast-tokio.md`](../../loaders/fast-tokio.md) with the other loaders
   (they glob `*.rs`). Kit-relative copies also live in [`rules/`](rules/).
6. Rewrite `profile/` for *this* product. Do not edit this pack for product facts.

## Files

| Path | Holds |
|------|-------|
| [`cargo.md`](cargo.md) | CPU cap, cargo gates, ticket vs CI |
| [`code-style.md`](code-style.md) | Short non-negotiables; links Google guide for API/layout depth |
| [`google-rust-style.md`](google-rust-style.md) | How the [Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html) complements this pack |
| [`comments.md`](comments.md) | One-line `//` / `///` |
| [`implementation.md`](implementation.md) | rust-skills map, Fast Tokio, Gjengset |
| [`tickets.md`](tickets.md) | Green-when `-p <crate>` fences |
| [`testing.md`](testing.md) | Unit vs live, Miri, cargo-fuzz |
| [`gjengset.md`](gjengset.md) | Language/API taste |
| [`agents.md`](agents.md) | `rust-senior-developer` dispatch |
| [`skills.md`](skills.md) | Which skill for which change |
| [`config.yaml`](config.yaml) | `commands.*` for a Cargo workspace |
| `skills/` | `rust-skills`, `rust-patterns`, `rust-best-practices`, `rust-async-patterns`, `fast-tokio` |
| `agents/` | Portable `rust-senior-developer` |
| `checklists/rust.md` | Code-reviewer checklist (`project.stack: [rust]`) |
| [`rules/`](rules/) | Kit-relative `jon-gjengset-rust.mdc`, `fast-tokio.mdc` |

## Do not put here

Crate names, `RUST_LAYOUT.md`, RisingWave, product laws, live fixture trees.
Those belong in the adopting repo's `profile/`.
