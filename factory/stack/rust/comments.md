# Comments (Rust)

A comment is one line, shorter than the code it explains. Names and types
carry the meaning; a comment adds only what they cannot. Kit
`policy/comments.md` is the language-neutral law; this file is the Rust shape.

## Rules

1. **One line.** `//` or a single-line `///`. No multi-line `/* */` blocks, no
   blank ` *` lines, no paragraphs.
2. **Shorter than the code.** If the comment is longer than the line or block
   it describes, rename or restructure the code instead.
3. **Say what it is, or the one non-obvious why.** Never restate the code.
4. **Only where needed.** Skip a comment when the name and type already say it.
5. **No boilerplate.** No `No side effects.`, `Does not fail.`, or per-symbol
   contract lists. Failure modes live in the return type and the tests.
6. **No tags unless rustdoc needs them.** No `///` that repeats the signature.
7. **No history or task talk.** No "added for X", "used by Y", "TODO later".
8. **No commented-out code.** Delete it.
9. **Never put secrets, tokens, or claim values in a comment.**

## Where the long text goes

| Content | Home |
|---------|------|
| Behavior contract, error semantics, limits | BINDING design or `paths.product_contract` |
| Cross-crate decisions | Numbered `D` in the design |
| Behavior of a function | A test named for it |
| Complete-system drawings | The design doc, not the source tree |

## Examples

Bad:

```rust
/// Closed set of failure codes. Eight members. Adding a member breaks
/// exhaustive matches.
///
/// No side effects.
pub enum ErrorCode { ... }
```

Good:

```rust
// Closed set of failure codes.
pub enum ErrorCode { ... }
```

Bad:

```rust
// Loop over the probes and run each one, then collect the results
let results: Vec<_> = probes.iter().map(run).collect();
```

Good (no comment; the code says it):

```rust
let results: Vec<_> = probes.iter().map(run).collect();
```

Good (one non-obvious why):

```rust
// Drop "" so an empty env var counts as missing.
```

## Review check

A reviewer rejects a comment that is more than one line, longer than its
code, or restates a name, type, or return value.
