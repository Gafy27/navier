# Boundary conditions

Boundary assignments use the face component on a named side:

```c
u.n[left] = dirichlet (U);
u.t[left] = dirichlet (0.);
p[left] = neumann (0.);
```

- `.n` is normal, `.t` is tangential. `u.x[left]` is not the boundary API.
- Assign them at file scope or in `init`, once. Assigning them every step
  from inside `foreach` is not a boundary condition.
- `dirichlet()` and `neumann()` take an expression qcc captures. A local
  variable from inside `foreach` is the wrong scope.
- Inflow speed comes from the config (and a ramp helper if the file has
  one), not a new numeric literal.
