# Explain the finding before the machinery

Use `paths.index_template`; `paths.index_pattern` owns order and ready criteria.
The example below illustrates writing style, not a researched source claim.
Replace citation placeholders with real sources and check every conclusion.
Use `<paths.profile>/skills.md` for project-specific examples when available.
An older note is evidence to consult, not authority to retain an obsolete shape.

## Lead with the answer

Avoid opening with:

> The selector dispatches to `_resolve_bounds`, then checks whether the index
> adapter returns a positional slice.

Explain the result first:

> The range selector includes the samples at both ends of the requested range.
> With samples at times 0, 1, and 2, selecting from 0 to 1 keeps the first two
> samples. This is an illustration of the documented endpoint rule, not a test
> execution (`<source documentation:line>`).

The internal dispatch may matter later, if it explains a limitation. It does
not help the user understand endpoint inclusion before they know the result.

## Connect the result to the project

> For the project's adjacent-window use case, the boundary sample could appear
> in both windows. For example, windows from 0 to 1 and from 1 to 2 both contain
> the sample at time 1. A design that needs each sample to belong to only one
> window must choose which boundary to exclude. That is an implication of the
> endpoint rule, not an approved window policy (`<project constraint:line>`;
> `<endpoint finding>`).

Do not assert that every project needs non-overlapping windows. Tie relevance
to the actual objective and cite its governing constraint. Where usefulness is
uncertain, explain that instead of inventing a requirement.

## Give each section a different job

- **Answer in plain language:** the direct result and any qualification that
  changes it. Define unfamiliar terms.
- **Why it matters for this project:** the practical consequence for this
  objective, distinguishing inference from existing requirements.
- **How it works:** one example, then the mechanism needed to explain its result.
- **Key findings and evidence:** the few precise claims supporting the answer,
  with citations and source context. Do not repeat the whole story as bullets.
- **Limits and unknowns:** missing evidence and its effect on the conclusion.
- **Research recommendation:** a proposed action, alternatives, and costs.
- **Technical references:** useful source navigation and signatures, after the
  explanation and recommendation.

## State confidence precisely

> The source documentation states that endpoints are included. We inspected
> the selection code but did not execute the proposed alternative. Duplicate
> timestamps were outside the inspected cases; support for them remains
> unverified (`<documentation:line>`; `<implementation:line>`).

Source inspection and execution establish different kinds of evidence. Do not
claim every source-backed result needs a runtime test, or call an unrun
expression tested. Put a qualification beside the affected claim when it could
change the reader's interpretation; do not hide it only in the limitations list.

## Recommend without approving a design

> **Recommendation:** adapt the selector with an explicit boundary convention
> if the window design requires non-overlap. Keep the choice for the design
> session; this note establishes the endpoint behavior, not product approval.
>
> **Considered:** subtracting a small value from the stop time makes correctness
> depend on clock resolution. Removing the last returned sample can remove a
> valid sample when the stop time is not present.
>
> **Why / consequences:** an explicit convention makes membership predictable.
> The candidate implementation still needs verification for the timestamp types
> and ordering the project actually supports.

These alternatives are illustrative. A real note must supply evidence for the
behavior it attributes to each option and avoid claiming unsupported coverage.

## Keep references useful

Give P0 sources a reason to open them: for example, "documents endpoint
inclusion" or "implements range resolution". Put relevant types and signatures
in Model, not function bodies. Link external evidence only when it supports a
finding or changes the recommendation. Explain source conflicts where their
claims occur; an appendix link alone does not resolve them.

Reader check: can the user explain the answer, why it matters, and the example
without opening the referenced code? If not, improve the explanation before
adding more source inventory.
