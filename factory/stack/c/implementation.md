# Implementation (C / Basilisk)

When the work **writes, reviews, or refactors C**. Kit method:
`policy/implementation.md`. This file is the skill map. Product layout:
adopting repo `<paths.profile>/layering.md`.

## Skills (on demand)

Do not preload the catalog. Start with
[`skills/basilisk/SKILL.md`](skills/basilisk/SKILL.md). Load only the
`rules/<id>.md` the change needs.

| Change | Rule |
|--------|------|
| New or edited solver (fields, events, BCs, grid) | `qcc-not-gcc`, `field-syntax`, `foreach`, `events`, `include-order` |
| Boundary or embed/fraction geometry | `boundaries`, `embed-vs-fraction` |
| OpenMP, `adapt_wavelet`, quadtree | `openmp-and-grid` |
| A `cc` test next to solver headers | `pure-c-vs-qcc` |
| Build directory, generated `*.c` | `scratch-files` |

Keep diffs minimal. Match the header you are editing. Do not add a second
solver entry point beside the one the generator emits.
