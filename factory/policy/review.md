# Reviewing a design and its anexo

Run when an architecture or program spec was written or amended, before that
artifact is BINDING. Review a ticket anexo only when requested; a reviewer
verdict is not required to execute an anexo. The agent is `spec-reviewer` in a
**fresh session**. The parent names the
artifact: `architecture`, `program`, or `anexo`. It reads that file,
`paths.plan`, `paths.product_contract`, and the BINDING siblings the claim
needs. It never edits the files and never reviews its own work. Open those
files as slices ([`reading.md`](reading.md)): search for the law, `D`, `PD`,
or validation id, then Read around the hit. A sibling claim is a targeted
open, not a full-file reread.

Architecture review does **not** require an anexo or program sibling.
Program review does **not** require an anexo; architecture must be BINDING.
Anexo review requires both siblings BINDING (or grandfather: [`design.md`](design.md)).
Validation-row checks (1–10, 14 as applicable) apply to **anexo** reviews.
Architecture reviews use 8, 10, 11, 12. Program reviews use 8, 10, 12, 13.

**Chat output is the VERDICT block** ([`agents.md`](agents.md)):

```
VERDICT: ready | fix-then-ready | not-ready
BLOCKER  <spec §/line> — <defect> — evidence: <path:line> — fix: <one line>
MAJOR    ...
MINOR    ...
```

If the parent asks for a review file, write it under `paths.reviews` for the
phase of the reviewed design (`{n}` in the path), from `paths.review_template`
(not a reliability assessment). Create the folder if it is missing. The file
does not replace the chat VERDICT.

## Severity

| Level | Meaning |
|-------|---------|
| CRITICAL | A validation row cannot observe the failure it claims to attack, or a law has no check |
| HIGH | Two files contradict, a session cannot legally do what it is told, or a tool a row needs is absent |
| MEDIUM | A row passes a wrong implementation, or two rules for one thing disagree |
| LOW | Naming, order, wording |

`VERDICT: not-ready` / `fix-then-ready` while any CRITICAL or HIGH is open;
`ready` otherwise. Say which points must be fixed before BINDING (or before
tickets, for an anexo) and which ride along.

## What to check (from past reviews)

Read each validation row as an attacker would. These failures recur:

1. **A row that cannot see its target.** A scratch file outside the compiler's
   include set typechecks clean. A row that attacks a rule with a witness the
   fixture never contains.
2. **A row with no passing case.** Only bad inputs: a schema that rejects
   everything still passes. Require one accepted input, and boundary values on
   both sides.
3. **A wrong value that still satisfies the check.** A check that "the claim is
   a string" accepts any string; require the near-miss.
4. **A tool the row needs but the repo lacks.** A binary assumed on the path;
   a command the config leaves empty.
5. **Two rows or sections that cannot both be true.** Sequence says every
   ticket edits a file while a ticket's fence forbids it.
6. **A session told to call what it cannot call.** A test that must exercise an
   unexported function, or a constructor owned by a later ticket.
7. **A type that still permits the banned thing.** An error that forbids
   `cause` but wraps a type that accepts it.
8. **Two standards for one rule.** Name the exception or remove it.
9. **Coverage.** Every numbered law, `D`, and program `PD` appears in ≥1 row
   or under "Not attackable" with a reason. Every numeric bound has a row on
   each side.
10. **Hardcoded values.** A vendor name, platform id, or limit as a literal in
    a design or identifier. They are config; examples go in an example column
    only.
11. **Impl-manual drift (architecture only).** The architecture spec only says
    how, with no alternatives or trade-offs ([`design.md`](design.md)). Program
    design is *supposed* to say how it lands; do not fail it for that.
12. **Architecture bulk.** On a new architecture spec, or on clauses this pass
    added: context copied from an index, a full interface or schema, a folder
    tree, a call graph, a law that only restates a `D`, an empty section kept
    as "N/A", or a file past ~400 lines with no split and no length
    justification in that pass's changelog ([`design.md`](design.md) §
    Architecture). Do not fail an older spec for length the pass did not add.
    Also fail a new architecture or program clause that breaks **Redaction**
    or **Cuts** in that section: two ideas in one sentence, ceremony, a
    repeated fact, a dropped not/never/no/only/except, a restated BINDING
    rule, or a module, type, or "for later" clause the decision does not
    need. Do not fail kit English for keeping articles. Do not fail an
    older clause the pass did not rewrite. Do not treat a missing gate as
    a cut.
13. **Program artifacts.** A program spec names types/signatures, test seams,
    and call sites. It also names layout and a call graph unless the unit is
    one file and one entrypoint. Call sites delegate to the module that owns
    the rule; they do not embed domain rules. Where the architecture requires
    post-commit work, it starts only after successful commit. Do not require
    transactions or background execution where they do not apply. No new
    product `D`.
14. **Anexo matches program.** Ticket fences, files, and SESSION read lists
    match the BINDING program spec (or the architecture spec if grandfathered).

Each finding names the file and row or section, quotes the line, says what a
cheating implementation would still pass, and gives a fix concrete enough to
apply.

## After the review

The **spec-reviewer** (or the parent, when no review file was requested) owns
the findings. The designer does **not** copy the chat `VERDICT` block or
reviewer prose into chat, into the design spec, or into the review file's
numbered finding sections. Do not add a "recording the review" step.

When a review file exists under `paths.reviews`, the designer **only** fills
the **Response** table: one row per finding number, with
`fixed | rejected | deferred` and a short *Where / why / owner* cell. Apply
spec fixes in the design artifact (`[pass N]` + in-place edits per
[`design.md`](design.md) § Editing a spec). Add one changelog row that **links**
the review file; do not paste findings into the changelog.

If review feedback arrived only in chat, fix the spec and add a changelog row
that cites the review round (date or session); do not create a review file just
to duplicate the chat transcript.

Re-review after a block. BINDING needs `VERDICT: ready` **and** an explicit
human yes, asked once if not already supplied ([`agents.md`](agents.md)). An
agent may record that approval under
[`design.md`](design.md#user-authorized-binding-status). An anexo is not marked
BINDING; its optional review does not add an execution gate. Report any known
conflict with BINDING siblings or other execution blocker before running tickets.
