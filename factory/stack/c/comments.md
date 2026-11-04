# Comments (C)

Kit law: `policy/comments.md`. This file is the C shape.

## Rules

1. **One line.** `//`. No multi-line blocks, no paragraphs.
2. **Shorter than the code.** Rename instead of writing a paragraph.
3. **Say what it is, or the one non-obvious why.** Never restate the code.
4. **Only where needed.**
5. **No history or task talk.** No commented-out code.

## Examples

Bad:

```c
/* This event sets the face viscosity from the Reynolds number
 * every iteration so the solver sees the right mu. */
event properties (i++)
```

Good:

```c
// properties: viscosity on faces
event properties (i++)
```

Good (no comment; the code says it):

```c
foreach_face()
  muv.x[] = fm.x[] * c->fluid.Lref * c->fluid.U0 / c->fluid.Re;
```
