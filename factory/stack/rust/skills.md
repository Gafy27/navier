# Skill bindings (Rust stack)

Maps this pack's skills. Product bindings (which crate owns Kafka, which
fixture is live) stay in the adopting repo's `<paths.profile>/skills.md`.

Skill directories below are relative to this pack's `skills/`; open their
`SKILL.md` entrypoints. When writing, reviewing, or refactoring Rust, always
load `rust-skills`, then only the `rules/<id>.md` the change needs. When the
task touches the Tokio runtime, load `fast-tokio` first. For crate layout and
public API design, read [`google-rust-style.md`](../google-rust-style.md). Also
read [`implementation.md`](implementation.md) for this pack's implementation rules.

| Skill | Use when |
|-------|----------|
| `rust-skills/` | Default. Open `SKILL.md`, then only `rules/<id>.md` the change needs |
| `rust-patterns/` | Crate layout, traits, concurrency |
| `rust-best-practices/` | Everyday idioms, Clippy, `Result` |
| `rust-async-patterns/` | Tokio channels, `select!`, cancellation idioms |
| `fast-tokio/` | **MUST** when design or code uses Tokio runtime (spawn, Mutex, fairness) |
| `ticket-testing` | Ticket SESSION — kit skill, then [`testing.md`](testing.md) |

`secure-code-writing`, Ponytail (when `tools.ponytail`), and the testing-code children stay
in the kit `skills/` folder, not this pack.
