---
name: naming
description: >
  MUST load when writing, reviewing, or refactoring code (with the secure-code
  skills in policy/implementation.md). Choose precise names: specific enough
  that a reader can guess what the name refers to without the docs, never
  broader or narrower than the thing itself. A name that is hard to pick is a
  design smell. From A Philosophy of Software Design, Ch. 14. Trigger: naming,
  rename, vague name, generic name, boolean name, sentinel, result variable,
  loop variable, review a name.
---

# Precise names

**Required read** for any implementation or code-review session: load this skill
with the four secure-code skills (`policy/implementation.md` § Secure code).

Good names have two properties: precision and consistency. This skill covers
precision.

## Rules

1. **Specific enough to guess.** A reader seeing only a call site should be able
   to guess what the name returns or holds. `getCount()` → count of what?
   `numIndexlets` says it. `x`, `y` for a character's position → `charIndex`,
   `lineIndex`.
2. **Booleans are predicates.** The name says what `true` means:
   `cursorVisible`, not `blinkStatus`.
3. **Special values name their meaning.** `NOT_YET_VOTED`, not
   `VOTED_FOR_SENTINEL_VALUE`.
4. **`result` only for the return value.** In a function that returns nothing,
   name what the value is: `mergedLine`, `totalChars`.
5. **Short names only for short scopes.** `i` and `j` are fine while the whole
   loop fits on screen. Once it doesn't, or the meaning is not obvious, use a
   descriptive name.
6. **Not too specific either.** Name what the code accepts, not one caller's
   case: `delete(range)`, not `delete(selection)`, when any range works.
7. **Hard to name means rethink the design.** If no name is precise, intuitive,
   and short, the variable likely has no clear purpose or holds several things.
   Split it or refactor; do not settle for a vague name.

Examples are in the book's Java/C++ casing; apply your language's casing.

## Red flags

| Flag | Signal |
|------|--------|
| Vague Name | The name could refer to many different things, so it conveys little and the thing is more likely to be misused |
| Hard to Pick Name | No simple name creates a clear image of the object, so the object may not have a clean design |

## Source

[`reference.md`](reference.md) — "Choosing Names", the part on precision,
verbatim.
