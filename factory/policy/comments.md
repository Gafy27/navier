# Comments

A comment is one line, shorter than the code it explains. Names and types
carry the meaning; a comment adds only what they cannot.

Language examples: `stack/<project.language>/comments.md`
(Rust: [`../stack/rust/comments.md`](../stack/rust/comments.md),
TypeScript: [`../stack/typescript/comments.md`](../stack/typescript/comments.md)).

## Rules

1. **One line.** No multi-line blocks, no blank ` *` lines, no paragraphs.
2. **Shorter than the code.** If the comment is longer than the line or block
   it describes, rename or restructure the code instead.
3. **Say what it is, or the one non-obvious why.** Never restate the code.
   If the information in a comment is already obvious from the code next to
   it, the comment is not helpful. The common case is a comment built from the
   same words as the name it describes: `// Get the user id` above
   `get_user_id()`.
4. **Only where needed.** Skip a comment when the name and type already say it.
5. **Simple and complete, or fix the design.** A method or variable comment
   says all a caller needs in plain words. If that is hard to write, the thing
   does too much or has no clear job: split or rename it, do not pad the comment.
6. **No boilerplate.** No `No side effects.`, `Does not fail.`, or per-symbol
   contract lists. Failure modes live in the return type and the tests.
7. **No tags unless a tool reads them.** No `@param` or `@returns` that repeat
   the signature.
8. **No history or task talk.** No "added for X", "used by Y", "TODO later",
   and no Ponytail `shortcut:` comments; shortcuts go in the report.
9. **No commented-out code.** Delete it.
10. **Never put secrets, tokens, or claim values in a comment.**

## Where the long text goes

| Content | Home |
|---------|------|
| Behavior contract, error semantics, limits | `paths.product_contract` or the unit's brief in `paths.designs` |
| Cross-unit decisions | `paths.decision_log` |
| Behavior of a function | A test named for it |
| Complete-system drawings | The design doc, not the source tree |

## Review check

A reviewer rejects a comment that is more than one line, longer than its
code, restates a name, type, or return value, or reuses the words of the name
it sits next to. When a method or variable cannot be described simply and
completely, the reviewer flags its design.
