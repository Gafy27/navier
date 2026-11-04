---
name: unit-testing
description: >
  Write unit tests that actually catch bugs: hermetic and fast, security cases
  as first-class cases, fakes over over-abstracted mocks, and no tolerated
  flakiness. From Building Secure and Reliable Systems, Ch. 13. Trigger: unit
  test, test coverage, mock, stub, fake, flaky test, TDD, parameterized test,
  regression test for a bug fix.
---

# Unit testing

Unit tests are the fast feedback loop. Their value depends entirely on what
they exercise and whether anyone still trusts them.

## Rules

1. **Hermetic and fast.** A test that cannot reproduce its result in isolation
   tells you nothing. No network, no shared state, no wall-clock dependence.
2. **Test the security cases, not just the happy path.** Negative amounts,
   overflow near type limits, malformed and malicious input, and the error
   message returned for each. These are the cases that reach production
   untested.
3. **Parameterize instead of copying.** Same logic, many inputs — one test body
   with a table. Duplication makes later refactors tedious enough to skip.
4. **Write them with the code, or before it.** TDD is one option; tests in the
   same commit as the change is the floor. Expect to spend more time on tests
   than on the code for nontrivial systems.
5. **Review tests as tests.** If deleting the new code (or replacing a condition
   with `true`/`false`) still leaves the suite green, the test is decorative.
6. **Design for testability.** Put an abstraction in front of external systems
   so tests can observe calls instead of making them. Refactoring for this is
   normal, not a smell.
7. **Prefer fakes owned by the component's team.** A realistic fake tracks the
   real service as it evolves; a hand-rolled mock in each caller does not.
8. **Don't over-abstract.** Tests that assert call order and argument plumbing
   test the language's control flow, not your behaviour. If every method change
   forces a test rewrite, the tests — or the architecture — are wrong.
9. **Fix flakes immediately.** Tolerated flakiness teaches everyone to ignore
   red, which is worse than having no test.
10. **Full coverage is not correctness.** Unknown edge cases and thin error
    handling survive 100% coverage.
11. **Every bug fix gets a test** that fails before the fix — that is what stops
    the regression from returning during a later refactor.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `unit-testing` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Unit Testing" through "Correctness
Validation", verbatim.
