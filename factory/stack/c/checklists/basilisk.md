# Basilisk checklist

Load when `project.stack` in `config.yaml` includes `basilisk`.

Severity: HIGH.

When reviewing C that touches a solver:

- **Compiled with the wrong driver** — a file that includes `grid/`,
  `navier-stokes/`, `embed.h`, or `fractions.h` built with `cc` / `gcc`
- **Field inside a function** — `scalar`, `vector`, or `face vector`
  declared in function scope, or indexed outside `foreach` / `foreach_face`
- **C loop used as a grid walk** — `for` over `N`, pointer arithmetic on
  `u.x`, `break` or `return` inside `foreach`
- **Missing reduction** — a `foreach` that writes a shared counter or sum
  and the build can pass `-fopenmp`
- **Include reorder** — `embed.h` after the solver, or a second grid header
- **Event called as a function** — `init(` or `properties(` from `main`
- **Dimensions turned back on** — `#include "dimensions.h"` or a drop of
  `-disable-dimensions` the design did not ask for
- **Scratch committed or compiled in the case folder** — `_*.c`, `.qcc*`
- **OpenMP on an adaptive grid** — `-fopenmp` together with quadtree /
  `adapt_wavelet`
- **Embed and fraction mixed** — `embed.h` and `fractions.h` in one
  translation unit

```c
/* BAD: shared counter, return inside foreach */
int n = 0;
foreach()
  if (cs[] > 0.) { n++; return 1; }

/* GOOD */
int n = 0;
foreach (reduction(+:n))
  if (cs[] > 0. && cs[] < 1.)
    n++;
```
