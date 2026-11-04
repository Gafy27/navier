# Scratch files

`qcc` writes beside the source it was given:

- `_name.c` — translated C. Never edit, never commit, never compile it
  yourself.
- `.qcc*` and a copied `src/` tree. Delete them after the link, the way
  the Makefile already does.

Run `qcc` from the build directory. Running it inside a case directory
drops that scratch next to `case.yaml` and `results/`.

Generated case sources (`build/<case>/<case>.c`, `wt_case.h`) are
outputs. Change the generator or the YAML. A hand edit is overwritten
on the next `make`.
