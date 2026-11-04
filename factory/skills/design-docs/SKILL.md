---
name: design-docs
description: >
  Write or amend binding architecture, program-design, and ticket-anexo
  artifacts. Use for designing a unit, API, or model and authoring its
  design-session prompts. Research indexes and reliability assessments have
  their own skills.
---

# Design documents

The artifact is the design. Work one pass per session. Do not write product
code or promote an artifact to BINDING on your own. An agent may record an
explicit user approval under `policy/design.md` § User-authorized BINDING status.
Existing design authority and human gates
remain required even when an implementation looks obvious.

## Read

Resolve the kit config, then read `modular-design`, `policy/design.md`,
`policy/decisions.md`, and `policy/reading.md`. Read the selected pass's
template and the relevant contract, brief, and BINDING sibling slices.

| Pass | Template key | Prerequisite | Artifact |
|------|--------------|--------------|----------|
| Architecture | `paths.design_template` | Named unit and researched constraints | `vocabulary.design_file` |
| Program | `paths.program_template` | Architecture BINDING | `vocabulary.program_file` |
| Anexo | `paths.tickets_template` | Architecture and program BINDING, or documented grandfathering under policy | `vocabulary.tickets_file` |

`policy/design.md` owns artifact contents, pass markers, length, redaction,
grandfathering, and lifecycle. `policy/review.md` owns review. Templates own
the document shape. Link those owners; do not recreate their full contents
in a skill or agent prompt.

## Workflow

1. Establish the unit, pass, prerequisites, and permitted output. For a design-session prompt, read `paths.design_sessions_template` instead of treating the prompt as a BINDING spec.
2. Separate facts from assumptions. Compare alternatives using `modular-design`: interface versus implementation, hidden decisions, necessary dependencies, and what a caller must know.
3. Resolve important gates through `policy/decisions.md` before writing their picks. Ask the parent for empirical evidence that the designer cannot gather with its tools.
4. Write the selected artifact from its template. Architecture explains trade-offs; program design lands them; anexo assigns verifiable slices with a `## Session brief (read first)` block in every implementer SESSION fence (`paths.tickets_template`). Editing a spec follows the in-place/pass/changelog rules in policy.
5. Register this pass in the phase README. Architecture and program passes hand off for a fresh spec-reviewer with the explicit kind. Anexo review is optional, on request. After an anexo write or material amend, the parent runs `python3 <kit>/cli.py bundle-session --anexo <tickets file> --all` (designer has no shell). The next pass waits for its required BINDING prerequisites. After review, apply fixes and the Response table only; do not transcribe findings (`policy/review.md` § After the review).

## Stop conditions

- Required input, authority, or source is missing: report the gap.
- A gate is unanswered or authorities conflict: return researched options; do not choose silently.
- A new unit lacks the program prerequisite for tickets: stop. Missing program files alone do not prove grandfathering.
- The selected artifact and registration are complete: hand off. Architecture/program require independent review and human approval for BINDING. Anexo execution requires no review verdict; report any unresolved blockers.

## Reply contract

Use the designer's fixed fields: `Artifact`, `Decisions`, `Unverified or
blocked`, and `Next`. Gate questions keep `policy/decisions.md`'s format.
Never claim review or approval that did not happen.

## Other document kinds

- Reference notes: `indexing` and `paths.index_pattern`.
- System assessments: `reliability-security`.
- Problem packets: `explaining-design-problems`.
- Design prompts: `paths.design_sessions_template`; they open a pass and are not authority to implement.

An already-covered, unambiguous code change can use its existing BINDING
authority or an explicit human exception. This skill grants no exception
to the repo's code or gate rules.
