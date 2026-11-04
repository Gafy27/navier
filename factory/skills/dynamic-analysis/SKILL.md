---
name: dynamic-analysis
description: >
  Instrumented runs find what tests miss: sanitizers for memory misuse, races,
  and undefined behaviour, at a large runtime cost — so schedule them, don't
  gate every commit. From Building Secure and Reliable Systems, Ch. 13.
  Trigger: sanitizer, ASan, TSan, MSan, Miri, valgrind, data race, deadlock,
  undefined behaviour, unsafe, FFI, C dependency, nightly job, coverage metrics.
---

# Dynamic program analysis

Static reading finds what the code says; instrumented execution finds what it
actually does with real inputs.

## Rules

1. **Instrumentation, not guessing.** The compiler inserts checks and a runtime
   keeps metadata (ASan's shadow memory, poisoned red zones around allocations),
   so the report names the allocation, the free, and the illegal use.
2. **Pick the sanitizer for the bug class.** Address (out-of-bounds,
   use-after-free), Leak, Memory (uninitialized reads), Thread (races,
   deadlocks), UndefinedBehavior.
3. **Budget for the slowdown.** Instrumented binaries can be orders of magnitude
   slower. The standard answer is a separate, less frequent pipeline — nightly —
   not a per-commit gate.
4. **Instrumentation has blind spots.** Hand-written assembly and binary-only
   libraries are not instrumented, which produces both false positives and
   missed bugs.
5. **Collect the other signals while you're there.** Coverage and profiling come
   from the same instrumented runs and make useful long-run code-health metrics.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `dynamic-analysis` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Dynamic Program Analysis" including the ASan
use-after-free walkthrough, verbatim.
