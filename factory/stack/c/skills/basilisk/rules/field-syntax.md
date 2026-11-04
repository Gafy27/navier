# Field syntax

`scalar p[]`, `vector u[]`, `face vector muv[]` are grid fields. The `[]`
is Basilisk syntax, not a C array size.

- Declare them at file scope, once. A declaration inside a function or
  inside an event is a new field every call.
- Index only inside `foreach()` (`u.x[]`, `p[1]`) or `foreach_face()`
  (`muv.x[]`). `u.x[1]` is the neighbor, `u.x[]` is this cell.
- Do not `malloc` a field, do not take `&u.x[0]`, do not pass `u.x` to a
  function that expects `double *`.
- Face fields use the face iterator. Cell-centered fields use `foreach`.
- `fm.x[]` and `fs.x[]` exist only when the grid headers that define them
  are included. Do not declare your own.

```c
/* BAD */
event init (t = 0) {
  scalar cs[];
  cs[0] = 1.;
}

/* GOOD: file scope, written inside foreach */
face vector muv[];

event properties (i++) {
  foreach_face()
    muv.x[] = fm.x[] * nu;
}
```
