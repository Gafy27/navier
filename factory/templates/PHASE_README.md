# Phase {n} — <short name>

Specs and tickets sit here. `prompts/` holds design and implementation session prompts, `history/` holds retired or absorbed docs, and `indexing/` holds the research notes for this phase.

Research index: [`indexing/README.md`](indexing/README.md).

**Objective:** <one product sentence: what the product can do when this phase closes>.

**Status:** <research only | designing | implementing | closed> (YYYY-MM-DD). <What is next.>

## Boundaries

- <Work a reader would expect here> lives in [Phase {m}](../phase-{m}/README.md).

| File | Role |
|------|------|
| `PHASE{n}_P{n}.1_<TOPIC>.md` | **draft** (YYYY-MM-DD) P{n}.1 <title> — D1–D<k>; <the core choice in one or two sentences>. Amends <ids> |
| `PHASE{n}_P{n}.1_<TOPIC>_PROGRAM.md` | **draft** (YYYY-MM-DD) P{n}.1 landing — signatures, seams, call sites; layout/call graph or mini-doc exception |
| `PHASE{n}_P{n}.1_<TOPIC>_TICKETS.md` | P{n}.1 tickets 1–<N> — `1 -> 2 -> <N>`; 1 <unit>, 2 <unit>, <N> remove complexity + full test. Program is draft — do not run until program BINDING |
| `prompts/PHASE{n}_P{n}.1_<TOPIC>_DESIGN_PROMPT.md` | Opens the P{n}.1 design session; produced the spec and anexo above |
