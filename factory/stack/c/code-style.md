# Code style (C and Basilisk)

Kit principles: `policy/rules.md`. Comments: [`comments.md`](comments.md).
Solver mistakes the model repeats: [`skills/basilisk/SKILL.md`](skills/basilisk/SKILL.md).
Product extras (case layout, which header is embed vs fraction): adopting
repo `<paths.profile>/code-style.md`.

- Solver translation units compile with `qcc`, never `cc` or `gcc`. Plain C
  that does not include a Basilisk header compiles with `cc -Wall -Wextra`.
- Basilisk fields (`scalar`, `vector`, `face vector`) are file-scope
  declarations. `p[]`, `u.x[]`, `muv.x[]` are field accesses, not C arrays.
- Grid iterators (`foreach`, `foreach_face`) are not C loops. Do not `break`,
  `return`, or take their address. Accumulate with a `reduction(...)` clause
  when the build may use OpenMP.
- Events (`event init`, `event properties`, …) are scheduled by `run()`.
  Do not call them.
- Include order is part of the program. `embed.h` before
  `navier-stokes/centered.h` on the embed path. Do not reorder includes to
  "look like C".
- Do not add `dimensions.h` or drop `-disable-dimensions` unless the design
  says so. This pack assumes code units.
- Do not edit `qcc` scratch: `_*.c`, `.qcc*`, or a copy of `src/` emitted
  next to the binary. Compile inside the build directory the Makefile names.
- Do not shadow Basilisk globals: `N`, `L0`, `origin`, `DT`, `CFL`, `t`,
  `dt`, `Delta`, `x`, `y`, `z`.
- Name recurring numbers. Spec values (a level, a CFL, a Reynolds number)
  come from the config struct, not a new literal in an event.
- Headers that use Basilisk macros stay header-only and included by the
  `qcc` translation unit. Do not build them into a `cc` static library.
