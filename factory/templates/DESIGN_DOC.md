# Architecture design template

Use this shape for binding architecture specs (`vocabulary.design_file` under
`paths.designs`). Adapt headings to the problem. Omit sections with nothing to
say; do not leave empty headings or "N/A". Do not paste these instructions into
the finished spec.

Architecture explains the chosen behavior, boundaries, and trade-offs. Exact
signatures, schemas, file layout, call graphs, and test seams belong in the
[program sibling](PROGRAM_DESIGN.md). Validation rows and ticket sequencing
belong in the [tickets anexo](TICKETS.md).

[Design policy](../policy/design.md) owns length, editing, pass markers, and
lifecycle. Target 1–3 pages; past ~400 lines, split or justify the length in
the pass's changelog row. [Decision policy](../policy/decisions.md) owns human
gates. [Review policy](../policy/review.md) owns independent review. This template
grants no exception to the repository's design or approval requirements.

## Header and navigation

Start with a descriptive title, status, and dependencies. Include `Public API:
vMAJOR.MINOR` only when the unit exposes a versioned API under the project rules.
Link the product contract and relevant BINDING designs instead of copying them.

```markdown
# <Unit>: <the change being designed>

Status: draft
Depends on: <links to governing contract and designs>
```

For an approved spec, use `Status: BINDING through pass N` under
[Editing a spec](../policy/design.md#editing-a-spec). Later draft passes do not
silently become approved. Record landed status only when implementation has
landed.

Add Contents only past ~400 lines. Use stable ids and heading links; optional
line hints aid navigation but are not authority. Cover decisions, laws,
blockers, and named sections rather than every subheading. Cap it at ~40 lines.

```markdown
## Contents
| Id / heading | Location |
|--------------|----------|
| D1 | [Single validation boundary](#d1--single-validation-boundary) |
| B-1 | [Unverified parser behavior](#b-1-unverified-parser-behavior) |
```

The sections below describe the output shape. Their examples illustrate form;
they do not choose a design for the project.

## Design explained

Put this section immediately after the header and Contents, before the detailed
sections. Write for the human who needs to understand the proposal without
knowing the codebase. Lead with the proposed solution, not the document's scope
or a list of section names.

Use a few short, connected paragraphs to explain:

- **What changes and why:** what the user can do with this design, and which
  problem in the current approach it solves.
- **How it works:** follow one concrete example from the user's input or action
  to the result. Introduce the main parts through their jobs and explain how
  they work together. Define unfamiliar terms when they first appear.
- **Why this design:** explain the main decisions in plain language, the benefit
  each brings, and the cost or limitation it accepts. Link each explanation to
  its detailed `D#`; link rejected alternatives to the relevant changelog row.

Explain the connection between the problem, the solution, and the decisions.
For example, do not stop at "configuration is declarative". Explain what the
user writes, what the system does with it, and why this approach helps them.
Add a small diagram only when it makes that flow easier to understand.

Keep detailed rules, inventories, signatures, and decision history in their
own sections or sibling documents. This explanation introduces the design;
it does not create separate requirements or make new decisions. Describe
proposed behavior as proposed, and identify any unresolved choice that changes
the explanation. Update this section when the design changes.

Reader check: after this section alone, can the human explain what is being
built, how the example works, and why the main decisions were made? If not,
rewrite the explanation before adding more detail elsewhere.

## Context and scope

State the current problem and the constraints that shape the solution. Keep
background to a few sentences and source links. Link detailed research or
measurements instead of copying an index note. Distinguish verified facts from
assumptions; put unresolved consequences under blockers below.

## Goals and non-goals

List the outcomes this unit must deliver. Name plausible capabilities explicitly
excluded from this proposal. A non-goal is a scope choice, not a negated quality
requirement such as "must not crash". Link existing product locks rather than
restating them. New scope choices follow decision policy.

## Responsibilities and dependencies

Describe the main parts through what each owns and what callers need to know.
Explain which decisions each part hides and why each dependency is necessary.
Use a short paragraph or a table when several parts need comparison:

| Part | Owns and hides | Caller-visible behavior | Depends on, and why |
|------|----------------|-------------------------|---------------------|
| <part> | <responsibility and hidden detail> | <promise> | <required dependency> |

Include a small system-context diagram when it clarifies the boundaries.
Keep concrete files, construction, and call graphs in program design.

## Decisions and rationale

Give each human-gated architecture pick a stable `D#`. State the current choice
first, then explain why it meets the goal and its practical implications.
Identify affected responsibilities and link the evidence that supports the
choice. Write the current design, not the history of the discussion.

Illustrative shape:

```markdown
### D1 — Single validation boundary

All input paths use the same validation boundary before processing begins.
This keeps acceptance rules consistent across callers. The boundary owns
validation failures; callers must handle rejection before starting work.
[pass 1]
```

Real decisions cite their supporting sources and governing clauses. Record
rejected alternatives and why they lost in the changelog, associated with the
relevant `D#`. Do not duplicate an alternatives section. Link to that record
when readers need to compare options. Never present an unanswered gate as a pick.

Sketch APIs or stored data only when their shape explains an architectural
trade-off. State caller-visible preconditions, errors, side effects, or ordering
when they matter to that decision. Full definitions belong in program design.
Code or pseudocode is exceptional: use it only to explain a novel algorithm.

## Invariants

Include only additional rules that decisions and governing contracts do not
already express. Give each a stable law id and an unambiguous statement of the
behavior that must hold. Link existing rules instead of creating another copy.
Detailed validation cases belong in the anexo.

## Unresolved questions and blockers

Include this section only when uncertainty remains. Separate assumptions from
verified constraints. For each item, name the affected decision, what cannot
proceed, and the evidence or human answer needed to resolve it.

| Id | Assumption or unknown | Source or evidence gap | Affected decision / blocked work | Resolution needed |
|----|-----------------------|------------------------|----------------------------------|-------------------|
| B-1 | <unverified behavior> | <source or missing probe> | <decision or work> | <specific evidence or gate answer> |

An assumption is not approval. Follow decision policy for gates. Resolve an item
in place when evidence arrives; retain the change's history in the changelog.

## Relevant cross-cutting concerns

Include only concerns this proposal changes: for example, trust boundaries,
data integrity, failure behavior, compatibility, or observability. Explain the
concrete effect and where responsibility sits. Link dedicated assessments when
needed. Do not add generic checklists or repeat unchanged project requirements.

## Changelog

End the spec here. Use the table defined in
[Editing a spec](../policy/design.md#editing-a-spec):

| Pass | Date | Status | Ids | Change | Rejected | Picked by |
|------|------|--------|-----|--------|----------|-----------|
| <N> | <date> | draft | <D / law / blocker ids> | <change or review link> | <D#: alternative and trade-off that ruled it out> | <human gate answer or review link> |

Keep review findings and responses in the review file. Edit current clauses in
place and mark each added or changed clause `[pass N]`; do not stack amendments
or reuse retired ids.

Independent architecture review and human approval precede BINDING status.
An agent may record explicit user approval under
[User-authorized BINDING status](../policy/design.md#user-authorized-binding-status),
without asking for that approval again.
The next artifact is program design, not tickets. Program design requires
BINDING architecture; tickets require the BINDING program sibling, subject to
the documented grandfathering rule in design policy.
