# Comments (TypeScript)

Kit law: `policy/comments.md`. This file is the TypeScript shape.

## Rules

1. **One line.** `//` or a single-line `/** ... */`. No multi-line blocks, no
   blank ` *` lines, no paragraphs.
2. **Shorter than the code.** Rename instead of writing a paragraph.
3. **Say what it is, or the one non-obvious why.** Never restate the code.
4. **Only where needed.**
5. **No boilerplate.** No `No side effects.` Failure modes live in the return
   type and the tests.
6. **No tags unless a tool reads them.** No `@param` / `@returns` that repeat
   the signature.
7. **No history or task talk.** No commented-out code. No secrets in comments.

## Examples

Bad:

```ts
/**
 * Closed set of failure codes. Eight members. Adding a member breaks
 * exhaustive switches.
 *
 * No side effects.
 */
export const ErrorCode = { ... } as const;
```

Good:

```ts
// Closed set of failure codes.
export const ErrorCode = { ... } as const;
```

Good (no comment; the code says it):

```ts
const results = await Promise.all(probes.map(run));
```

Good (one non-obvious why):

```ts
// Drop "" so an empty env var counts as missing.
```
