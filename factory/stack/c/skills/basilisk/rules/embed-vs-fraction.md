# Embed versus fraction

Two body representations. One translation unit gets one of them.

| | Embed | Fraction |
|--|-------|----------|
| Headers | `embed.h` then the centered solver | `grid/multigrid.h`, centered solver, `fractions.h` |
| Geometry | `solid (cs, fs, phi)` | volume fraction via `fractions.h` |
| Force | `embed_force` | the fraction header's own surface integral |
| Velocity BC on the body | embed's Dirichlet on the cut | the fraction solver's boundary |

- Do not include both `embed.h` and `fractions.h`.
- `cs[]` is the cell fraction (1 fluid, 0 solid). A cut cell is
  `cs[] > 0 && cs[] < 1`. Do not treat `cs` as a color function you
  advect unless the design is a VOF case.
- `phi` for `solid()` is negative inside the solid, the Basilisk
  convention. Do not flip the sign to match a signed-distance habit
  from another code.
- The adopting repo already splits these into two headers. Add code to
  the header the generator includes for that `body.repr`. Do not merge
  them.
