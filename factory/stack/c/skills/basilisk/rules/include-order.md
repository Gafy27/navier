# Include order

qcc's view of the grid is fixed by the first grid header. Later includes
do not switch it.

Embed path (cut-cell), in this order:

```c
#include "embed.h"
#include "navier-stokes/centered.h"
```

Volume-fraction path, in this order:

```c
#include "grid/multigrid.h"
#include "navier-stokes/centered.h"
#include "fractions.h"
```

- One of those two paths per translation unit. See
  [embed-vs-fraction](embed-vs-fraction.md).
- Project headers come after the Basilisk headers, so `foreach` and the
  solver fields exist.
- The generated case `.c` owns this list. Change it in the generator the
  profile names, not by editing the generated file.
- Do not add `grid/octree.h` or `grid/quadtree.h` next to `multigrid.h`.
