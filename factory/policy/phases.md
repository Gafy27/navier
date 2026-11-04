# Phases

How a phase folder under `paths.designs` is laid out, and what its README
says. Specs follow [`design.md`](design.md); research notes and the
`indexing/README.md` router follow [`indexing.md`](indexing.md). This file
covers the folder and the README that maps it.

**First action:** copy `paths.phase_readme_template`. Do not start from a
blank page.

## Folder layout

```text
<paths.designs>/
  README.md                  paths.plan — one row per phase, plus cross-phase docs
  rejected/                  paths.designs_rejected — never a starting point
  phase-{n}/
    README.md                the map: one row per file in this folder
    <vocabulary.design_file>     architecture spec
    <vocabulary.program_file>    program spec (lands the architecture)
    <vocabulary.tickets_file>    its tickets anexo, same id
    prompts/                 *_DESIGN_PROMPT.md and SESSION files
    reviews/                 paths.reviews — design reviews, reliability assessments
    history/                 retired or absorbed docs
    indexing/                research notes; its README is the router (indexing.md)
```

1. The phase root holds specs, anexos, and phase-wide notes (a live demo, a
   cross-spec walkthrough). Everything else goes in a subfolder.
2. Create a subfolder when its first file lands, not before. A research-only
   phase is `README.md` plus `indexing/`.
3. Phase numbers and `P{n}.{k}` ids are never reused. If an id moves, say so
   in both rows and in the spec.
4. Cross-phase docs and dev-harness designs stay at `paths.designs`,
   unprefixed, and are listed in `paths.plan`.

## What the phase README holds

In this order:

| Section | Content |
|---------|---------|
| Title | `# Phase {n} — <short name>` |
| Folder sentence | The fixed line from the template naming `prompts/`, `history/`, `indexing/` |
| Research index | Link to `indexing/README.md`, when it exists |
| Objective | One product sentence: what the product can do when the phase closes |
| Status | `research only`, `designing`, `implementing`, or `closed`, dated, plus what is next |
| File table | `\| File \| Role \|`, one row per file (below) |

Add only when true:

| Section | When |
|---------|------|
| Boundaries | Work a reader would expect here lives in another phase; link it |
| Numbering note | Other specs cite this phase under an old number or id |
| What is missing today | Research-only phase: a gap table checked against a named commit and date |

## The file table

One row per file in the phase, including `prompts/`, `reviews/`, and
`history/` entries (path relative to the phase). `indexing/` is not listed
file by file; its router is. Sort by id, each architecture spec followed by its program sibling then its anexo.

**Spec row**, in this order:

1. Status, bold, from `vocabulary.status_flow`, with the date:
   `**draft** (YYYY-MM-DD)`. A retired spec reads
   `**RETIRED by <id>** — do not run`.
2. Id and title.
3. The decision range (`D1–D9`, laws `L1–L6`).
4. The core choice in one or two sentences.
5. Links both ways: `Amends <ids>` and `Amended by <id> (date)`.

**Program row:** status and date; one sentence on how the architecture lands
(tree, entrypoint, or mini-doc exception). `Amends` / `Amended by` if the
landing changed.

**Anexo row:** ticket range, order (`1 -> 2 -> 3`, or which tickets may run
side by side), the unit each ticket edits, prerequisites, and run state:
`Program is draft — do not run until program BINDING` (or `Spec is draft —
do not run until BINDING` when grandfathered with no program sibling),
`runnable`, or `complete; do not re-run`.

**Other rows** (prompt, review, demo note): one line on what it is for and
what it produced.

Keep a cell short. It points to the spec; it does not restate it. If a cell
grows past three lines, the detail belongs in the spec. Implement the spec,
never the cell.

## What the README does not hold

- Decisions or their reasoning. They live in the spec.
- Ticket progress. It lives in the anexo's Progress block.
- Research findings. They live in `indexing/`.
- Locked research defaults. They live in the `indexing/README.md` router.

## Keeping it true

1. Edit the README in the same change as the file it describes: a new spec,
   a status change, an amendment, a move to `history/`.
2. The README is a hot file. Re-read it before editing; make one anchored
   edit per row. Never rewrite it wholesale.
3. When a spec amends another, update both rows in the same change.
4. Retire by moving the file to `history/`, keeping its row, and changing
   the status to `RETIRED by <id>`. Do not delete the row.
5. Reject by moving the file to `paths.designs_rejected` and moving its row
   to that folder's README.

## Opening a phase

1. Create `phase-{n}/` and copy `paths.phase_readme_template` to its README.
2. Fill the title, Objective, and Status.
3. Add the phase row to `paths.plan` in the same change.
4. If research comes first, create `indexing/README.md` per
   [`indexing.md`](indexing.md).
