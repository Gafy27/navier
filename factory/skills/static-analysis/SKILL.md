---
name: static-analysis
description: >
  Analysis without running the code: linters and AST checks with auto-fixes,
  where to place them in the workflow, the false-positive budget that decides
  whether anyone listens, and when deeper methods are worth their cost. From
  Building Secure and Reliable Systems, Ch. 13. Trigger: clippy, lint, static
  analysis, code inspection, auto-fix, review-time check, false positives,
  abstract interpretation, formal methods, verification.
---

# Static program analysis

Cheap, shallow, and early beats deep, slow, and late — for everything except
the few properties worth proving.

## Rules

1. **Know which tier you're in.** Syntactic/AST pattern matching (linters) runs
   at roughly compile speed and scales to any codebase. Semantic analysis over
   control and data flow (abstract interpretation) is far slower and belongs in
   a nightly or review-time job. Formal methods cost most and need the property
   written down first.
2. **Run the fast tier as early as possible.** Fix cost rises steeply once code
   is merged or deployed.
3. **The false-positive budget is the whole game.** Google's platform targets a
   user-perceived false-positive rate of at most 10% and disables checks that
   miss it. A noisy check trains people to ignore all checks.
4. **Prefer checks that carry a fix.** A warning the author applies with one
   action gets applied; a warning that requires archaeology gets suppressed.
5. **Statically verifying arbitrary programs is undecidable** — every tool
   trades false positives against false negatives. Choose the trade per stage
   (precise and narrow in review; stricter before a safety-critical release).
6. **Auto-fixes are also a migration tool.** Codebase-wide modernizations are
   the same machinery as single warnings.
7. **Reserve the deep tier for properties that justify it** — the ones where
   being wrong is expensive and the invariant can be stated precisely.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `static-analysis` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Static Program Analysis" through "Formal
Methods", including the Clang-Tidy and Error Prone walkthroughs, verbatim.
