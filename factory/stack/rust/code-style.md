# Code style (Rust)

Layout, imports, and public API depth:
[`google-rust-style.md`](google-rust-style.md) →
[Google Rust Style Guide](https://google.github.io/styleguide/rustguide.html).
This file stays the short non-negotiable list; it does not duplicate that guide.

Language-neutral principles: kit `policy/rules.md`. Comments:
[`comments.md`](comments.md).

- No magic values: named `const`s or enums. Spec values (status codes, limits)
  always get a constant.
- Flat code: early return, `let … else`, `?`. No arrow anti-pattern.
- Function names under 30 characters.
- Enums over bools for function parameters.
- Empty lines between logical blocks.
- Prefer newtypes over stringly ids ([`skills/rust-skills`](skills/rust-skills/SKILL.md)
  `type-newtype-ids`).
- Match the crate's existing module layout. Workspace crate map lives in
  `<paths.profile>/layering.md` of the adopting repo.
