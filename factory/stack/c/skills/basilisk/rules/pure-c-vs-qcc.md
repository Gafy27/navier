# Pure C versus qcc

Geometry, config, and kinematics that do not touch the grid stay
compilable with `cc`. That is what the fast tests run.

A file is pure C when it does **not** include, directly or through a
project header:

- `grid/*.h`, `navier-stokes/*.h`, `embed.h`, `fractions.h`, `run.h`

If a helper needs `foreach` or `cs[]`, it belongs in the solver header
included only by the `qcc` translation unit, and its test is a `qcc`
target in the build directory.

Do not ifdef a Basilisk include into a pure-C test to "make it link".
Split the function instead.
