# foreach is not a C loop

`foreach()`, `foreach_face()`, `foreach_dimension()`, and
`foreach_boundary()` are qcc iterators over the grid.

Inside the body, `x`, `y`, `z`, and `Delta` are the cell. They are not
in scope outside it.

- No `break`, `continue`, `return`, or `goto` out of the iterator.
- No C `for (int i = 0; i < N; i++)` to walk cells. `N` is the root
  resolution, not the leaf count.
- A sum or counter that must survive the iterator uses
  `foreach (reduction(+:n))`. Without it, `-fopenmp` races.
- `foreach_dimension()` doubles the body. Write the `x` component; qcc
  emits `y` (and `z` in 3D). Do not also hand-write the `y` copy.
- Point samples use `interpolate()`, not a field index at an arbitrary
  coordinate.

```c
/* BAD */
int n = 0;
foreach()
  if (cs[] > 0.) { n++; return n; }

/* GOOD */
int n = 0;
foreach (reduction(+:n))
  if (cs[] > 0. && cs[] < 1.)
    n++;
```
