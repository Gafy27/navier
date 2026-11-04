---
name: integration-testing
description: >
  Integration tests use the real dependencies, so they buy confidence and cost
  speed and stability — and must never be seeded with production data. From
  Building Secure and Reliable Systems, Ch. 13. Trigger: integration test, live
  test, docker compose stack, real database, QA endpoint, test data, seeding,
  end-to-end, test environment.
---

# Integration testing

Replace the fakes with the real thing and you exercise the paths units cannot
reach — at the price of latency, setup, and flakiness.

## Rules

1. **Use real implementations, accept the cost.** Slower and flakier than unit
   tests; the payoff is confidence that composed components actually work.
2. **Never mirror production data into a test environment.** It is tempting
   because the data is rich; it exposes sensitive data to anyone who can run
   tests and violates least privilege. Seed with non-sensitive test data.
3. **Seeded test data also buys you a clean slate.** You can wipe to a known
   state, which is the cheapest cure for integration flakiness.
4. **Talk to a QA/staging endpoint, not production.** The point is exercising
   the real client library, not creating real side effects.
5. **Log at the logical junctures.** When an integration test fails and every
   unit test passes, logs at the stage boundaries are the difference between
   minutes and a day.
6. **Know the limit.** Integration tests say little about behaviour in scenarios
   they don't run. They complement unit tests; they don't replace them.

## Project bindings

Repo-specific tools, paths, and commands for this skill live in the profile, not here: `<paths.profile>/skills.md`, section `integration-testing` (`<kit>` is `paths.kit` in `config.yaml`).

## Source

[`reference.md`](reference.md) — "Integration Testing", verbatim.
