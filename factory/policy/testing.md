# Testing

When the work **writes tests**, **reviews tests**, **selects or runs project tests**,
or **implements a ticket**. Test kinds
and locations are in `paths.standards`; this project's test rules (fixtures, what is never
mocked) are in `<paths.profile>/testing.md`.

## Load order

1. Resolve `paths.profile` from the kit config. Read
   `<paths.profile>/testing.md`.
   This document owns project suite
   selection, prerequisites, behavior journeys, evidence, and cleanup.
2. Tickets: also skill `ticket-testing`.
3. Skill `testing-code` (router), then only the matching child when writing or
   reviewing tests. Read `stack/<project.language>/testing.md` when provided.

A required profile document that is missing blocks the work; report it
instead of using the default profile. These reads do not expand a ticket's scope,
override Green when, or authorize additional live checks. Validation-contract
V-rows are implemented as tests in owning tickets; there is no validator agent.

Do not load all children. Do not skip for a "small" ticket.

| Work | Load |
|------|------|
| Implementing a binding-spec ticket | `ticket-testing`, then one child below |
| Pure functions, parsers, planners, fakes of our own interfaces | `unit-testing` |
| A real dependency (database, broker, identity provider fixture, composed server) | `integration-testing` |
| Sanitizers, race/UB, instrumented runs | `dynamic-analysis`, only if the design names it |
| Parsers of untrusted bytes | `fuzz-testing`, only if the design names it |
| Type, lint, import-boundary checks | already in the Green-when fences |

## Written vs run

| Artifact | Owns |
|----------|------|
| `ticket-testing` + this file | Which tests to write |
| [`tickets.md`](tickets.md) Green when | Which commands must run |
| Validation contract | V-rows in ticket tests; optional manual attack at `full` |

## Rules

- **Default: unit.** Use integration only where the behavior lives in the external
  system or the wire. Do not use a live test as a substitute for a unit test of the
  same law.
- Do not add a sanitizer or fuzz pipeline the design did not name.
- Do not mock the framework or the owning client library. A local fake of an external
  service is allowed only where a design names it.
- A test never calls a live third party. It builds its own fixtures.
- A test pins documented behavior. Never loosen an assert, delete a test, or weaken a
  ban to get green.
- Contract tests import only a unit's public entry point.
