---
name: rust-best-practices
description: >
  Guide for writing idiomatic Rust code based on Apollo GraphQL's best practices handbook
  and Logan Smith's "5 Strong Opinions On Everyday Rust". Use this skill when:
  (1) writing new Rust code or functions,
  (2) reviewing or refactoring existing Rust code,
  (3) deciding between borrowing vs cloning or ownership patterns,
  (4) implementing error handling with Result types,
  (5) optimizing Rust code for performance,
  (6) writing tests or documentation for Rust projects,
  (7) handling pattern matching, unit returns, and unsafe blocks.
license: MIT
compatibility: Rust 1.70+, Cargo
metadata:
  author: apollographql + logan-smith
  version: "1.2.0"
allowed-tools: Bash(cargo:*) Bash(rustc:*) Bash(rustfmt:*) Bash(clippy:*) Read Write Edit Glob Grep
---

# Rust Best Practices

Apply these guidelines when writing or reviewing Rust code. Based on Apollo GraphQL's [Rust Best Practices Handbook](https://github.com/apollographql/rust-best-practices) and Logan Smith's everyday Rust rules.

## Best Practices Reference

Before reviewing, familiarize yourself with Apollo's Rust best practices. Read ALL relevant chapters in the same turn in parallel. Reference these files when providing feedback:

- [Chapter 1 - Coding Styles and Idioms](references/chapter_01.md): Borrowing vs cloning, Copy trait, Option/Result handling, iterators, comments, unit semicolons, container references, when to extract a function (duplication vs. wrong abstraction)
- [Chapter 2 - Clippy and Linting](references/chapter_02.md): Clippy configuration, important lints, workspace lint setup, unsafe lints
- [Chapter 3 - Performance Mindset](references/chapter_03.md): Profiling, avoiding redundant clones, stack vs heap, zero-cost abstractions
- [Chapter 4 - Error Handling](references/chapter_04.md): Result vs panic, thiserror vs anyhow, error hierarchies
- [Chapter 5 - Automated Testing](references/chapter_05.md): Test naming, one assertion per test, snapshot testing
- [Chapter 6 - Generics and Dispatch](references/chapter_06.md): Static vs dynamic dispatch, trait objects, parameter vs. return type bounds
- [Chapter 7 - Type State Pattern](references/chapter_07.md): Compile-time state safety, when to use it
- [Chapter 8 - Comments vs Documentation](references/chapter_08.md): When to comment, doc comments, rustdoc
- [Chapter 9 - Understanding Pointers](references/chapter_09.md): Thread safety, Send/Sync, pointer types, unsafe block hygiene

## Quick Reference

### Borrowing & Ownership
- Prefer `&T` over `.clone()` unless ownership transfer is required.
- **Never use immutable references to containers.** Pass or return a reference to the inner item or slice instead to make APIs flexible and well-abstracted:
  - Prefer `Option<&T>` over `&Option<T>`
  - Prefer `&[T]` over `&Vec<T>`
  - Prefer `&str` over `&String`
  - Prefer `&T` over `&Box<T>`
- Small `Copy` types (≤24 bytes) can be passed by value.
- Use `Cow<'_, T>` when ownership is ambiguous.

### Expressiveness & Pattern Matching
- **Be intentional with unit semicolons:** If a function returning `()` calls another function, use a trailing semicolon (`fn_call();`) to visibly and intentionally discard the return value. Only omit the semicolon if you mean to explicitly bind the caller's return type to the callee's signature.
- **Never use enum wildcard imports in matches:** Never write `use SomeEnum::*;` above a `match` statement. If an enum variant is later deleted, the unqualified variant name degrades into a silent catch-all variable pattern, destroying the compiler's ability to warn you about unreachable or missing arms. Alias the enum type instead (e.g., `type E = SomeEnum;`).

### Error Handling
- Return `Result<T, E>` for fallible operations; avoid `panic!` in production.
- Never use `unwrap()`/`expect()` outside tests.
- Use `thiserror` for library errors, `anyhow` for binaries only.
- Prefer `?` operator over match chains for error propagation.

### Performance
- Always benchmark with `--release` flag.
- Run `cargo clippy -- -D clippy::perf` for performance hints.
- Avoid cloning in loops; use `.iter()` instead of `.into_iter()` for Copy types.
- Prefer iterators over manual loops; avoid intermediate `.collect()` calls.

### Linting
Run regularly: `cargo clippy --all-targets --all-features --locked -- -D warnings`

Key lints to watch:
- `redundant_clone` - unnecessary cloning
- `large_enum_variant` - oversized variants (consider boxing)
- `needless_collect` - premature collection
- `unsafe_op_in_unsafe_fn` - enforce explicit `unsafe {}` blocks inside `unsafe fn` bodies (`#![deny(unsafe_op_in_unsafe_fn)]`)

Use `#[expect(clippy::lint)]` over `#[allow(...)]` with justification comment.

### Testing
- Name tests descriptively: `process_should_return_error_when_input_empty()`.
- One assertion per test when possible.
- Use doc tests (`///`) for public API examples.
- Consider `cargo insta` for snapshot testing generated output.

### Generics & Dispatch
- Prefer generics (static dispatch) for performance-critical code.
- **Never return `impl Into<T>` from a function:** It forces the caller to write `.into()` at every call site, introducing unnecessary code overhead. Call `.into()` inside the function body and return the concrete type. Reserve `impl Into<T>` strictly for function parameters.
- Use `dyn Trait` only when heterogeneous collections are needed.
- Box at API boundaries, not internally.

### Unsafe Code & Pointers
- **Keep unsafe blocks tiny:** Never rely on the default behavior where the entire body of an `unsafe fn` implicitly acts as an unsafe block. Always wrap unsafe operations in explicit, minimal `unsafe {}` blocks inside unsafe functions so that undefined behavior is easily traceable.

### Type State Pattern
Encode valid states in the type system to catch invalid operations at compile time:
```rust
struct Connection<State> { /* ... */ _state: PhantomData<State> }
struct Disconnected;
struct Connected;

impl Connection<Connected> {
    fn send(&self, data: &[u8]) { /* only connected can send */ }
}