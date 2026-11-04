# Events

An `event` is a schedule, not a function. `run()` in `main` executes them.
Do not call `init()`, `properties()`, or `logfile()`.

- `event init (t = 0)` runs once, after the grid exists. Geometry (`solid`,
  initial `u`) goes here, not at file scope.
- `event properties (i++)` runs every step. Face viscosity goes here so
  the solver sees it.
- Time forms: `(t = t0; t <= tmax; t += dt)` or `(i += stride)`. Prefer
  the form the file already uses.
- `t`, `dt`, `i` inside an event are the solver clock. Do not shadow them
  with a local of the same name.
- `DT` and `CFL` are globals. Set them before `run()`, from the config
  struct, not with a literal in the event.

```c
/* BAD */
int main (void) {
  init();
  properties();
}

/* GOOD */
event init (t = 0) { /* solid, initial velocity */ }
int main (int argc, char ** argv) { return wt_main (argc, argv); }
```

The adopting repo's entry point is the one the generator emits. Do not
add a second `main`.
