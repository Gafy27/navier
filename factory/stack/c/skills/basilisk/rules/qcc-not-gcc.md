# qcc, not gcc

`qcc` is the compiler for a translation unit that includes a Basilisk
header (`grid/`, `navier-stokes/`, `embed.h`, `fractions.h`, `run.h`).

- Invoke `qcc` on the `.c` file. Do not compile the `_*.c` it writes.
- Flags this pack expects: `-Wall -O2 -disable-dimensions`, then `-lm`.
- Link with the same `qcc` line. A later `gcc` link of a Basilisk object
  drops the grid runtime.
- Plain C with none of those includes uses `cc -Wall -Wextra`. See
  [pure-c-vs-qcc](pure-c-vs-qcc.md).

```c
/* BAD: header uses foreach, compiled as C */
cc -Wall src/wt_events.h

/* GOOD: qcc on the generated translation unit, from the build dir */
qcc -Wall -O2 -disable-dimensions case.c -o wt -lm
```
