---
name: ticket-testing
description: >
  Systematic tests for a binding-spec ticket. Load when implementing a
  SESSION block, writing Green-when rows, or adding tests that prove a spec
  law. Trigger: implement ticket, SESSION, Green when, ticket testing
  pattern, which tests to write.
---

# Ticket testing

**First action** on a ticket that lands behavior: read
[`policy/tickets.md`](../../policy/tickets.md) § Token discipline, then this file, then only
the matching [`testing-code`](../testing-code/SKILL.md) child. Do not load
all five.

How tests are **run** is `policy/tickets.md` and the SESSION **Green when**.
This skill is how they are **written**. Validation-contract rows land as tests
in the owning ticket; there is no separate validator agent.

## When to use

- Implementing a `*_TICKETS.md` SESSION
- Design session naming Green-when test rows
- Any change that should prove a spec law

## When not

- Ticket N (remove complexity): no new tests except replacements for deleted private structure
- Ad-hoc validator probes outside the anexo contract
- Adding a sanitizer or fuzz pipeline the design did not name

## Pattern (do in this order)

1. List the spec laws / D ids **this ticket** lands (not the whole spec).
2. For each law, pick the cheapest test that would go red if that law were inverted.
3. Load only that child skill. Write the test in the same change as the code.
4. Run exactly the Green-when commands. Do not run `commands.test_all` unless this
   is ticket N.

If deleting the new branch (or flipping a condition to `true`/`false`) still
leaves the suite green, the test is decorative — rewrite it.

## Kind table

| This ticket lands | Kind | Load |
|-------------------|------|------|
| Pure types, errors, parse, policy | unit | `unit-testing` |
| Public API / golden output | unit | `unit-testing` |
| Invariant over many inputs | property | `unit-testing` |
| Real external system named in Green when | live | `integration-testing` |
| Untrusted bytes, no live stack | table of bad inputs | `unit-testing`; `fuzz-testing` only if the design names it |
| Lint / unrepresentable states | static | already in fences |
| Unsafe / FFI | dynamic | `dynamic-analysis` only if the design names it |

**Default: unit.** Live only when Green when already names the live command.
Do not add live tests a ticket did not name. Do not use a live test as a
substitute for a unit test of the same law.

Locations and fixtures: `<paths.profile>/testing.md`.

## Ticket N

No new behavior. No new tests except to replace a test that only covered
deleted private structure. If a named row fails for a reason other than the
remove-complexity diff, stop and report the owning ticket.

## Green when vs this skill

| Artifact | Owns |
|----------|------|
| SESSION Green when (implementer) | Which commands must run |
| This skill | Which tests to write so those commands mean something |
| Validation contract | V-rows written at design time; landed as tests per owner ticket |

Do not invent extra suites or live rows to "be thorough".
