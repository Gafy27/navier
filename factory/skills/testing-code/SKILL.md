---
name: testing-code
description: >
  Router for the five "Testing Code" skills extracted from Building Secure and
  Reliable Systems (Google/O'Reilly), Chapter 13. Load when you want the
  chapter's overall argument or don't yet know which testing skill applies.
  Trigger: testing strategy, what tests do I write, test pyramid, testing
  chapter, SRS book, coverage, CI test stages.
---

# Testing code for security and reliability (chapter router)

Chapter 13 of *Building Secure and Reliable Systems* in five loadable skills.
Load the one that matches the task; do not load all five.

## The chapter's argument in four lines

1. No single technique finds every bug. Each has a different cost–benefit
   profile, and one form of testing is not a substitute for another.
2. Testability is a design property. Code written without it cannot be tested
   well later.
3. The machine should generate the inputs you didn't think of — fuzzing and
   static analysis exist because human-chosen cases run out.
4. Value comes from running all of it continuously, not from having written it.

## Which skill

| Task at hand | Load |
|--------------|------|
| Writing or reviewing unit tests, fakes, flaky tests, TDD, coverage | [`unit-testing`](../unit-testing/SKILL.md) |
| Tests against a real database, broker, or service; test data; env setup | [`integration-testing`](../integration-testing/SKILL.md) |
| Sanitizers, race/UB detection, memory bugs, instrumented nightly runs | [`dynamic-analysis`](../dynamic-analysis/SKILL.md) |
| Parsers and untrusted bytes; generated inputs, corpora, crash triage | [`fuzz-testing`](../fuzz-testing/SKILL.md) |
| Linters, compile-time checks, review-time analysis, formal methods | [`static-analysis`](../static-analysis/SKILL.md) |

## Relation to the other skills

- [`secure-code-writing`](../secure-code-writing/SKILL.md) is the companion router: those five remove bug classes by construction, these five test for the rest.
- Which tests to write and which commands to run are project policy: `policy/testing.md` and `policy/tickets.md`. Ticket SESSIONs load [`ticket-testing`](../ticket-testing/SKILL.md) first.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `testing-code` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — chapter introduction and conclusion, verbatim.
