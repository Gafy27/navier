# Design

When the user asks to **design** something (a unit, an API, an interface, a model
change), run **three passes** with the same `designer` agent. Architecture
decides what and why. Program design lands that architecture in the tree.
Tickets are written only after program design is BINDING.

1. Read the skills `design-docs` and `modular-design` (in that order; both required).
2. Read `paths.design_template` (architecture) or `paths.program_template`
   (program pass), the unit's brief in `paths.designs`, the product contract
   (`paths.product_contract`, which wins), and
   `<paths.profile>/layering.md`.
3. Write only the artifact this pass owns (below). Register it in the phase
   README ([`phases.md`](phases.md)).

Do not start from a blank page. Do not design only in chat: the file *is* the
design. No product code in a design session. Open briefs, BINDING siblings, and
index notes as slices ([`reading.md`](reading.md)); do not load a whole phase
spec to find one `D` or blocker.

Public API versioning, if the project has it, is `<paths.profile>/layering.md`.
Changing a frozen export is an API change.

Before locking numbered `D`s or `PD`s, follow [`decisions.md`](decisions.md):
research, then stop and ask. Never pick an important trade-off silently. An
index note's decision is not a `D` ([`indexing.md`](indexing.md)). Reliability
assessments stay on [`reliability.md`](reliability.md). `paths.designs_rejected`
is never a starting point.

When an architecture or program artifact is on disk, run its independent
review ([`agents.md`](agents.md), [`review.md`](review.md)). Do not mark it
BINDING until `VERDICT: ready` and human approval. Anexo review is optional,
on request; it is not an execution prerequisite. Do not write or run tickets
until the program sibling is BINDING.

## User-authorized BINDING status

An agent may mark a named architecture or program spec, or a named pass,
BINDING when the user explicitly instructs or approves that status change.
The instruction supplies human approval; do not ask for the same approval again.
A request to write or review a design alone does not authorize BINDING status.

Apply the change to the approved scope only: update the header, the relevant
pass's changelog status and approval record, and any corresponding artifact
status in the phase README. Preserve later draft passes and unresolved items.
Record the user's instruction accurately; never invent a review result or gate
answer. Do not rewrite unchanged design clauses for a status-only change.
Do not create a new design pass merely to record approval.

Required independent review still applies unless the user explicitly overrides
it. If that prerequisite is unmet, report it instead of claiming review passed.
Without explicit human approval, agents must not promote a design themselves.
Ticket anexos remain execution plans, not BINDING artifacts.

## Editing a spec

The spec states only what is true now. It is not a record of how it got there.

1. **Edit in place.** A picked `D` or `PD`, a review fix, or an amendment
   rewrites the clause it changes. No "previously", "originally named", dates,
   who picked, question letters, "Rejected", or "Cost accepted" in clause text.
2. **Pass marker.** Each session that adds or changes design clauses is the next
   pass number. Status-only approval follows the section above.
   Every clause it adds or changes ends with `[pass N]`. Replace the old
   marker; never stack two.
3. **Remove, do not strike.** A dropped clause is deleted. Its id is retired
   in the changelog and never reused.
4. **Changelog** is the last section, one row per pass, added in that pass:

   ```markdown
   ## Changelog
   | Pass | Date | Status | Ids | Change | Rejected | Picked by |
   |------|------|--------|-----|--------|----------|-----------|
   | 3 | 2026-10-12 | draft | D26, V115 | Added; kind renamed LakehouseOnly → Static | NAMES owns derive too — puts storage classification in NAMES | owner, O-1=A |
   ```

   *Rejected* is the alternatives-considered record: each option the pass
   turned down and the trade-off that killed it. *Picked by* is `owner, Q<n>=<pick>`
   or a link to the review file under `paths.reviews`. A review round is one
   row that links that file (or cites the chat review round when no file
   exists). Reviewer findings stay in the review file's numbered sections (or
   in chat); the designer's **Response** table rows stay in the review file
   only—never copy findings verbatim into the spec or into chat.
5. **Status by pass.** The header says `BINDING through pass N`. A clause
   whose marker names a later, `draft` pass has no implementation authority
   until the human approves BINDING status. An agent may record that approval
   under **User-authorized BINDING status** above (flip its changelog row and
   the header).

Specs written before this rule keep their shape. A new pass on one adds the
Changelog section and marks only what it edits; it does not rewrite untouched
history unless the human asks.

## Three passes

```
research (indexes → source)
        │
        ▼
  architecture gates (Ds)
        │
        ▼
  architecture spec          vocabulary.design_file
        │
        ▼
  spec-reviewer (architecture) → human: mark architecture BINDING?
        │
        ▼
  program-design gates (PDs only; no new product Ds)
        │
        ▼
  program spec               vocabulary.program_file
        │
        ▼
  spec-reviewer (program) → human: mark program BINDING?
        │
        ▼
  tickets anexo              vocabulary.tickets_file
        │
        ▼
  tickets may run (anexo review only on request)
```

| Pass | Writes | Must already be BINDING | Review kind |
|------|--------|-------------------------|-------------|
| Architecture | `vocabulary.design_file` | — | architecture |
| Program | `vocabulary.program_file` | architecture spec | program |
| Anexo | `vocabulary.tickets_file` | architecture **and** program | optional, on request |

Same `designer` agent for all three. Fresh session per pass. Do not write the
anexo in the architecture or program pass.

**Grandfather:** a unit whose architecture is already BINDING and that has no
program sibling may keep running an existing anexo. New units, and amendments
that rewrite an anexo, need a BINDING program sibling first.

## Architecture (pass 1)

Write `paths.design_template` into `vocabulary.design_file`. The file is
trade-offs: numbered `D`s, the modules those `D`s seat, and the changelog
*Rejected* column. Sketch only the API or storage that carries a trade-off.
Omit a section that has nothing to say; do not write "N/A". A law that only
restates a `D` does not belong. Context is a few links, not a copy of an
index note. Full interfaces, schemas, folder trees, and call graphs belong
in program design. If the file only says how to implement, with no
alternatives, stop and do not ship it.

**Length.** Target 1–3 pages. A **Contents** table is required only once the
file is past ~400 lines. Past ~400 lines, split or justify the length in
that pass's changelog row. Specs already on disk keep their shape until a
pass edits them; do not restyle untouched clauses to meet this cap.

**Redaction.** Prose in a new architecture or program clause follows these
sentence rules (from [`caveman.md`](caveman.md); the file stays kit English,
not Caveman voice):

- One idea per sentence. About 20 words. Active voice.
- No ceremony and no second sentence that repeats the first. Cut
  "it is worth noting", "simply", "basically", and "just".
- Never drop not, never, no, only, or except.
- `D` ids, `PD` ids, type names, signatures, and paths stay verbatim.

Do not drop articles or write fragments to sound terse.

**Cuts.** From [`ponytail.md`](ponytail.md), applied to the spec, not to a
silent product pick ([`decisions.md`](decisions.md) still gates a `D` or
`PD`):

- Does this paragraph, module, or option need to exist for the decision?
  If not, omit it. Name the omitted option in *Rejected* when a reader
  would look for it.
- A rule already in a BINDING sibling or the product contract is a link,
  not a restatement.
- No module, type, config, or "for later" clause nobody needs for this
  decision. Deletion beats a new section.
- A one-line clause that needs decoding is not short. Write the plain
  sentence.
- Never cut the trade-off, a rejected alternative, a negation, or a gate.

The designer does not load the Ponytail skill. A reviewer fails a new
clause that breaks **Redaction** or **Cuts**
([`review.md`](review.md) § What to check).

Write the validation contract **in the anexo pass**, not here. Briefs and
`*_DESIGN_PROMPT.md` are not designs. Do not restyle a landed spec unless asked.

## Program design (pass 2)

Write `paths.program_template` into `vocabulary.program_file`. Architecture
must already be BINDING. This file is how that architecture lands:

1. Types and method signatures
2. Program layout (folder tree; which file owns which rule)
3. Call graph from the entrypoint down
4. Test seams
5. Call sites (callers delegate to the module that owns the rule and specify
   required ordering; work required after commit starts only after successful
   commit, when a transaction applies)

**Mini-doc:** if the unit is one file and one entrypoint, omit layout and call
graph. Still write signatures, seams, and call sites.

Do not reopen an architecture `D`. Landing trade-offs are `PD#`. Domain rules
live behind one module boundary; transport procedures stay thin.

## Anexo (pass 3)

Copy `paths.tickets_template` to `vocabulary.tickets_file` only after the
program spec is BINDING. Ticket rows, file fences, and SESSION prompts must
match the program file (paths, call sites, seams). Write the validation
contract **before** any code, and make each row able to fail for the right
reason ([`review.md`](review.md) §What to check). SESSION read-before-writing
includes `ticket-testing`. Green-when names the commands only
([`tickets.md`](tickets.md)). After the anexo is written or materially amended,
the parent runs `python3 <kit>/cli.py bundle-session --anexo <file> --all` so
implementers get `paths.runs/<anexo-stem>/ticket-N-brief.md` (designer lists
this in `Next`; designer has no shell).

## Design session prompts

When **creating** or **editing** `*_DESIGN_PROMPT.md` or unit `DESIGN_SESSIONS.md`
blocks, follow `paths.design_sessions_template`:

- Whole task and **done means** in each fenced block. One pass per block
  (architecture, program, or anexo).
- No “think carefully” / “think step by step” lines.
- Keep going until the finish line or a [`decisions.md`](decisions.md) gate.
- Long passes may keep a `TASKS.md` checklist.
- End with **Blocked on me** / **Changed** / **Found** (and **Could not confirm**
  under **Found** when research was incomplete).
