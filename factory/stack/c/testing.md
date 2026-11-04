# Testing (C / Basilisk)

Kit testing method: `policy/testing.md`. Which binary is the smoke case:
adopting repo `<paths.profile>/testing.md`.

- Two compilers. `cc -Wall -Wextra` for code that has no Basilisk include.
  `qcc` for anything that uses a grid, a field, or an event. Do not "fix"
  a `qcc` failure by compiling the same file with `cc`.
- `qcc` tests run in a build directory and delete `_*.c`, `.qcc*`, and the
  copied `src/` afterwards. They do not run inside a case folder.
- **Default: the fast test.** A full `run()` is integration. Add one only
  when the design names the case and the tag.
- A test does not read a previous run's `results/` as an oracle unless the
  design names that file.
- Do not add ASan, fuzz, or a new grid to a test the design did not name.
