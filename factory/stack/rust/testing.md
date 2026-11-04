# Testing (Rust)

Kit testing method: `policy/testing.md`. This file is the Rust kind table.
`test-` mechanical rules stay on [`skills/rust-skills`](skills/rust-skills/SKILL.md).

## Load order (tickets)

1. Kit `ticket-testing`, then one `testing-code` child
2. Only the `rust-skills` `test-*` rules this ticket needs

| Task | Load |
|------|------|
| Implementing a binding-spec ticket | `ticket-testing`, then one child below |
| Hermetic unit / fakes / TDD / coverage | `unit-testing` |
| Real database, broker, or composed server named in Green when | `integration-testing` |
| Sanitizers, Miri, `unsafe` | `dynamic-analysis` — only if the design names it |
| Parsers, untrusted bytes, cargo-fuzz | `fuzz-testing` — only if the design names cargo-fuzz |
| Clippy, types, review-time checks | already in Green-when fences |

## Written vs run

| Artifact | Owns |
|----------|------|
| `ticket-testing` + this file | Which tests to write |
| [`tickets.md`](tickets.md) Green when | Which `cargo` commands must run |
| Validation contract | V-rows in ticket tests |

**Default: unit.** Live only when Green when already names `--ignored`.
Do not use a live test as a substitute for a unit test of the same law.
Do not add a sanitizer or fuzz pipeline the design did not name.

## Kind table

| This ticket lands | Kind | Load | Typical location |
|-------------------|------|------|------------------|
| Pure types, errors, parse, policy | unit | `unit-testing` | sibling `*_tests.rs` or `#[cfg(test)]` |
| Public API / golden output | unit | `unit-testing` | `tests/*.rs` |
| Invariant over many inputs | property | `unit-testing` + `test-proptest-properties` | `proptest` |
| Real external system named in Green when | live | `integration-testing` | `tests/live_*.rs`, `#[ignore]` |
| Untrusted bytes, no live stack | table of bad inputs | `unit-testing`; `fuzz-testing` only if named | fixtures next to the parser |
| Clippy / unrepresentable states | static | already in fences | `cargo clippy -D warnings` |
| `unsafe` / FFI | dynamic | `dynamic-analysis` only if named | do not add a sanitizer job speculatively |

Live fixtures, what is never mocked, and integration setup: adopting repo
`<paths.profile>/testing.md`.
