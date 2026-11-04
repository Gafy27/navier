---
name: strong-types-and-sanitizers
description: >
  Pick tools that remove bug classes by default: memory-safe languages, static
  type checking, newtypes instead of bare strings/ints/floats, unit-carrying
  types, and sanitizers/race detectors in CI. From Building Secure and Reliable
  Systems, Ch. 12. Trigger: newtype, primitive obsession, stringly typed, units,
  duration, implicit conversion, sanitizer, data race, miri, undefined behaviour.
---

# Security and reliability by default

Language and type choices decide which bug classes are even possible.

## Rules

1. **Memory safety is the largest single lever.** Roughly 70% of Microsoft's
   vulnerabilities and 85% of Android bugs were memory-management errors. Rust
   already banks this; the obligation transfers to `unsafe` blocks and to any
   C/C++ dependency.
2. **Static, strong typing over runtime discovery.** Without it you can conclude
   almost nothing about code short of 100% coverage, and failures surface in
   production on the rarely exercised paths.
3. **Never pass meaning in a bare primitive.** `AddUserToGroup(string, string)`,
   `Rectangle(3.14, 5.67)`, `Circle(double)` — argument order and meaning are
   guesses. `Add(User("alice"), Group("root-users"))` is self-documenting and
   checked at compile time.
4. **Encode the unit in the type,** and give it only the sensible operations:
   timestamp − timestamp = duration; timestamp + timestamp is meaningless.
   Conversions are explicit (`Duration::ToHours`). Unit confusion has cost a
   $125M orbiter and nearly an airliner.
5. **No implicit conversions.** Truncation, precision loss, and accidental
   object construction come from coercion. Constructors take exactly what they
   mean.
6. **Use named instrumented checks at their configured stage.** Follow
   [`policy/testing.md`](../../policy/testing.md) and
   [`dynamic-analysis`](../dynamic-analysis/SKILL.md). Run sanitizer or race
   checks only when the design names them and commands are configured; do not
   introduce a pipeline implicitly. Report unavailable required checks.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `strong-types-and-sanitizers` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Security and Reliability by Default": tool
choice, strong types, sanitizers, verbatim.
