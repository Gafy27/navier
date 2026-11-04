# OpenMP and the grid

Basilisk OpenMP (`-fopenmp`) applies to `foreach` on **multigrid and
Cartesian** grids only.

- A quadtree / octree grid, or any `adapt_wavelet`, stays serial. Do not
  pass `-fopenmp` for that case.
- Every shared accumulation in a `foreach` that may be compiled with
  OpenMP needs `reduction(+:name)` (or `max:`, `min:`).
- Do not put an MPI domain split (`qcc -grid=...` with a multigrid-mpi
  header) into a file the design did not name. This pack is shared-memory
  unless the design says otherwise.
- `mgp.i` is the Poisson iteration count. Logging it is fine. Treating a
  non-zero value as a failed step is not.
