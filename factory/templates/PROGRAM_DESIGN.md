# Program design template

Use this shape for program specs (`vocabulary.program_file` under
`paths.designs`). The architecture sibling must already be BINDING. This file
specifies how that architecture becomes an implementable program; it does not
reopen product decisions or assign tickets.

Adapt or combine headings when that improves readability. Omit optional content
that does not apply. Do not paste these instructions into the finished spec.
Name concrete owners and interfaces, without inventing layers or dependencies
to fill the template. Use the project's language and existing conventions.

[Design policy](../policy/design.md) owns editing, pass markers, and lifecycle.
[Decision policy](../policy/decisions.md) owns human gates; landing picks use
`PD#` and cite the architecture `D#` or law they implement.
[Review policy](../policy/review.md) owns independent review. No new product `D`
belongs here. If implementation requires an architecture change, report the gap
rather than choosing a different product behavior.

## Header and navigation

Start with a descriptive title, `Status: draft`, `Architecture:` (a link to the
BINDING sibling), and `Depends on` (other governing designs or contracts).
For approved passes use `Status: BINDING through pass N`; later draft clauses
remain unapproved under design policy. Record landed status only after landing.

Add a Contents table linking section headings and stable `PD#` or other ids.
Optional line hints aid navigation. Cap it at ~40 lines.

## Implementation explained

Before signatures and inventories, explain the implementation in a few short,
connected paragraphs for a reader unfamiliar with the codebase. Lead with the
main idea: what existing parts are reused, what changes, and how those parts
work together. Link the architecture's explanation instead of repeating it.

Walk through one concrete use, from input or action to result. Introduce names
through their jobs before using them in types or diagrams. A short usage
example helps when an interface is central to understanding the design.
Explain the main landing decisions and their practical costs; link their `PD#`.
Distinguish proposed behavior from existing behavior and mention blockers that
could change this explanation. Keep it current as the design changes.

Reader check: can the human explain how the program works and why its main
parts fit together before reading the detailed sections?

## Types, signatures, and caller contracts

Name the interfaces, types, and signatures precisely enough to implement.
Distinguish public interfaces from internal helpers that this design needs to
fix. State the project-relative file or existing owner for each. Do not list
every private function or paste an entire implementation.

For each relevant boundary, specify what the caller must know: inputs, returned
values, preconditions, failures, side effects, and ordering. Explain mutation,
ownership, copying, resource lifetime, or concurrency when they affect correct
use. Link inherited architecture semantics rather than repeating them. Identify
new landing details explicitly; do not hide new product behavior in a signature.

## Architecture rules mapped to owners

Show where the architecture's decisions and laws are enforced. Group rules
with the same owner. Reference their ids instead of copying their text:

| Architecture ids | Owning file / operation | Enforcement or delegation |
|------------------|-------------------------|---------------------------|
| <D# / law> | <path and operation> | <where the rule takes effect> |

For a rule supplied by an existing dependency, name that boundary and explain
how this program uses it. Expose gaps or competing owners before implementation.
This is an ownership map, not the anexo's test-coverage matrix.

## Program layout and construction

Name the files added or changed and what each owns. Use a folder tree or a
compact table. Identify imports, exports, registrations, or integration changes
needed to make the unit usable. Link existing layout instead of listing an
unchanged repository tree.

Describe how parts are created and connected when this is not obvious from
their interfaces. Simple functions or direct construction are valid; this
section does not require a container, service, or injection framework.

## Call graph and execution flow

Trace the entrypoint to its result, including relevant calls, state changes,
and side effects. Show validation and failure ordering where an incorrect
sequence would violate a rule. Identify synchronous, asynchronous, or concurrent
execution only where it matters. Do not assume storage, a network, or a
transaction exists. A diagram is optional; a short ordered flow is often enough.

## Test seams

Name the boundaries tests can exercise, what may be substituted, and what must
stay real to observe the behavior. Prefer existing seams over new abstractions.
Explain how a test can observe a relevant failure or side effect when that is
not obvious. No substitutes are required for a fully real, in-memory test.

Keep detailed validation rows, fixture inventories, and ticket commands in the
anexo. This section defines the access and control tests need, not a second
test plan.

## Call sites and integration

List existing or new callers, the operation each calls, and required changes.
If there are no production callers yet, say which examples or tests demonstrate
use; do not invent consumers. Show who supplies inputs and consumes results.
Callers delegate rules to their owning module rather than duplicating them.

State ordering constraints where they apply. Work that the architecture
requires after a transaction commits must start only after successful commit.
A handoff may be a direct call; it does not require background execution.
Preserve required failure handling and delivery guarantees.

## Landing decisions

Use stable `PD#` ids for human-gated landing trade-offs. State the chosen shape,
its architecture references, rationale, and consequences. Keep rejected options
and gate answers in the changelog, with the relevant `PD#`. Do not turn routine
facts into extra gates or reopen an architecture decision.

Illustrative miniature; names and behavior are not project requirements:

```markdown
### PD1 — One processing boundary

The input adapter and direct caller both call `process`. This operation owns
the checks required by architecture L1 and validates before doing work.
Sharing the boundary keeps acceptance rules consistent across entrypoints.
[pass 1]

Interface: `process(input: Input) -> Output` in `src/processing`.
It leaves input unchanged and raises `InvalidInput` on rejection. [pass 1]

Flow: caller invokes `process`; it validates, performs the work, and returns
Output. Rejection prevents work. Both entrypoints use this flow. [pass 1]

Seam: tests call the real operation with small inputs; a counter at the work boundary
observes whether rejection prevents work. [pass 1]
```

A real spec supplies concrete paths, signatures, sources, and architecture ids
in its appropriate sections. The miniature illustrates detail, not a mandatory
split into helpers. Layout and call graph may be omitted only when the unit is
one file and one entrypoint. Signatures, seams, and call sites are still required.
Sections may combine without dropping required content.

## Unresolved questions and blockers

Include only when needed. Give each item a stable id, the affected interface or
owner, the work it blocks, and the evidence or human answer needed to resolve
it. Distinguish assumptions from verified constraints. An unanswered question
does not authorize the implementer to choose; follow decision policy.

## Changelog

End with the table from
[Editing a spec](../policy/design.md#editing-a-spec):

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| <N> | <date> | draft | PD1 | Shared processing boundary | PD1: duplicate checks in adapters; acceptance rules could drift | <human gate answer> |

The row illustrates the decision above; replace it with the actual pass record.
Edit current clauses in place, mark added or changed clauses `[pass N]`, and
record one changelog row per pass. Link reviews; findings and responses stay in
the review file. Independent review and human approval precede BINDING status.
An agent may record explicit user approval under
[User-authorized BINDING status](../policy/design.md#user-authorized-binding-status),
without asking for that approval again.
The [tickets anexo](TICKETS.md) follows only after this program spec is BINDING,
subject to the documented grandfathering rule in design policy.
