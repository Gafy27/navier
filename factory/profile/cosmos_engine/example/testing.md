<!-- UNFILLED -->
# Project testing

Replace this template using evidence from the selected project. Keep the
generic testing method in Factory policy and keep project recipes in the
profile's `testing.md`.

## Test selection

Document the repository's actual fast tests, scoped tests, broader suites,
and when each is required. Do not invent commands.

## Launch

Document an existing, bounded way to launch the target behavior, if one exists.
Otherwise state the verified prerequisite or that no launch harness was found.

## Doctor

List checks for prerequisites and readiness, using existing repository tools.

## Drive

Describe bounded feature journeys supported by existing executable harnesses.

## Evidence

State what outputs or artifacts prove a journey ran, and how to retain them.

## Cleanup

Describe cleanup for resources the journey creates. Never use production or
shared data; use private generated fixtures for any explicitly required live
dependency.

## Execution policy

- Run ticket-scoped tests and an affected behavior journey when observable
  runtime behavior changes.
- Reproduce bugs before and after fixes. Run relevant journeys at subphase
  close; run selected or full suites on demand.
- Exercise any verification recipe changed by the work. Docs-only work needs
  no runtime journey.
- An unavailable required check is blocked and unverified, never a pass.
- Execute one available journey before calling a recipe verified. Preserve
  evidence after cleanup; if execution is impossible, state the prerequisite
  and exact unverified scope.
- Factory installation validates structure, not application behavior.

## Generic skills

Follow Factory's `policy/testing.md`, `testing-code`, and the matching child
skill such as `unit-testing` or `integration-testing` as the work requires.
