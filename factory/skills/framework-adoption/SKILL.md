---
name: framework-adoption
description: >
  How to introduce a safe API and retire the unsafe one: compile-time feedback
  over late linting, small libraries over universal ones, reviewed exemptions,
  incremental rollout, single legacy-conversion function. From Building Secure
  and Reliable Systems, Ch. 12. Trigger: deprecate API, migrate callers, legacy
  code, lint vs compiler, new safe wrapper, rollout, escape hatch, allowlist.
---

# Introducing a safe API and retiring the unsafe one

A safe library nobody adopts changes nothing. Adoption is a design problem.

## Rules

1. **Fail at compile time.** Compiler errors are immediate and actionable.
   Lints and review comments arrive after the code is finished and working, when
   re-architecting is most annoying — that is when guidance gets ignored.
2. **Prefer a simple checker developers understand over a clever one.** Chasing
   false-positive/false-negative rates yields whole-program analyses whose
   findings take a debugging session to understand. A syntactic rule that is
   easy to explain and easy to fix wins in practice.
3. **Suggest the fix, not just the error.** Even a fix that doesn't quite
   compile saves the developer from hunting the right function and imports.
4. **Start small.** A library covering the common cases correctly beats a
   universal one that is hard to explain, hard to use, and hard to verify.
   Offering two shapes (one for complex cases, one for snippets) is fine.
5. **Exemptions are a queue, not a leak.** Route unusual cases through a
   reviewed unsafe API. Volume stays low, reviews stay deep, reviewers stay
   interested — and repeated requests tell you what to build next.
6. **Roll out incrementally.** Exempt existing callers explicitly, block new
   ones (annotation allowlist, restricted visibility, commit hook), let active
   development drain the rest, then clean up the remainder by hand.
7. **One legacy-conversion function per type.** Funnel every "I have a bare
   string here" case through a single obviously named function. Then you remove
   one function per type, not one per API.
8. **Safe types pay off most on new code.** Google saw two orders of magnitude
   fewer XSS reports in a framework built with safe types from the outset; the
   residual bugs were in the parts that skipped them.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `framework-adoption` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Lessons for Evaluating and Building
Frameworks", rollout strategy, and legacy conversions, verbatim.
