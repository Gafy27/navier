---
name: basilisk
description: >
  Write and review Basilisk solver C compiled with qcc (fields, foreach,
  events, embed, fractions, OpenMP). Use when editing .c or .h that includes
  a Basilisk header, when the build uses qcc, or when the user mentions
  Basilisk, qcc, foreach, embed, or a wind-tunnel solver.
---

# Basilisk

qcc translates this C before gcc sees it. Ordinary C habits (local arrays,
`for` loops, `return` from a macro, reordering includes) produce solvers
that compile and are wrong.

Read [`code-style.md`](../../code-style.md) once. Then open only the rule
files this change needs.

## Rules

| Id | Open when |
|----|-----------|
| [qcc-not-gcc](rules/qcc-not-gcc.md) | Compiling, choosing `cc` vs `qcc`, linking |
| [field-syntax](rules/field-syntax.md) | Declaring or indexing `scalar` / `vector` / `face vector` |
| [foreach](rules/foreach.md) | Any `foreach`, `foreach_face`, reduction, or stencil |
| [events](rules/events.md) | `event`, `run()`, `init`, timestep hooks |
| [include-order](rules/include-order.md) | Adding or moving a `#include` of a Basilisk header |
| [boundaries](rules/boundaries.md) | `dirichlet`, `neumann`, `u.n`, walls |
| [embed-vs-fraction](rules/embed-vs-fraction.md) | `embed.h`, `fractions.h`, `solid`, `cs` |
| [openmp-and-grid](rules/openmp-and-grid.md) | `-fopenmp`, `adapt_wavelet`, quadtree, multigrid |
| [pure-c-vs-qcc](rules/pure-c-vs-qcc.md) | A test or helper that must stay free of Basilisk |
| [scratch-files](rules/scratch-files.md) | `_*.c`, build dir, generated case source |

## Do not

- Invent a `main` that calls events.
- Turn dimensions back on.
- Mix `embed.h` and `fractions.h` in one file.
- Edit generated case `.c` or `wt_case.h` by hand. Change the generator
  or the YAML the adopting repo names in `profile/`.
