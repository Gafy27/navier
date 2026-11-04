# Problem packet: {short name}

## Introduction

Required. First section. Do not skip, shorten to a title, or leave TBD.

Write 1–3 short paragraphs a solver with no prior context can use:

- What this part of the system is and where it sits
- What is going wrong, or which decision is blocked
- Why that matters (who/what is affected)

Outcome language only. No proposed design, types, crates, or "we should".

{paragraphs}

## Goal

{One sentence. Outcome, not mechanism.}

## Current behavior

{What happens today. Cite files. Include the failure / pain if there is one.}

## Non-goals

- {Helpful-creativity kill-switch. What the solver must not expand into.}

## Constraints

Hard laws. Each one names what breaks if violated.

- {budget / compatibility / safety / existing contract / forbidden action}

## Preferences

Optional. Drop this section if empty.

- {taste that must not be treated as a constraint}

## Authority order

When sources disagree, this wins. Default:

1. Tests / CI
2. Current code behavior
3. Current project rules / runbooks
4. Older docs

## Repo anchors

3–10 paths. Each line: path + why it is truth for this problem.

- `{path}` — {why}

## Prior art

- Reuse: {existing helper / pattern / prior change}
- Do not reinvent: {what already exists}
- Do not copy: {known-bad approach, with why}

## Evidence

Facts gathered for this packet. Path references, not chat paraphrase.

- `{path}:{line}` — {what it shows}

## Assumptions

Labeled guesses. The solver may challenge these.

- Assumption: {claim} — because {reason}

## Unknowns

- {question the solver must not silently fill}

## Oracle

How we will know the solution worked. Checks, not construction.

- {test / invariant / benchmark / review question}

## Examples

Concrete cases. Include at least one failure / edge.

| Input / situation | Expected |
| --- | --- |
| {case} | {what must be true} |

## Return shape

One of: **options** | **decision** | **implementation**

{What to bring back. For options: 2–3 approaches, trade-offs, recommendation.
For implementation: keep the diff reviewable; cite anchors used.}

## Solver instructions

Procedural only. No design.

- Read every repo anchor before proposing
- Do not add abstractions without justifying against Constraints
- If a required fact is missing, stop and list it under Blocked
