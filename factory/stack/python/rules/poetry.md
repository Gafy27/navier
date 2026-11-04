---
paths:
  - "**/*.py"
  - "**/*.pyi"
  - "**/pyproject.toml"
  - "**/poetry.lock"
  - "**/requirements*.txt"
  - "**/setup.py"
  - "**/setup.cfg"
---
# Python Project Management: Poetry

Poetry (2.x) is the only project and dependency manager. This rule wins over
tool advice in other Python skills (pip, uv, pipenv, conda, hatch, setuptools).

## Must

- Every Python project has a `pyproject.toml` with a PEP 621 `[project]` table,
  `[build-system]` on `poetry-core`, and a committed `poetry.lock`.
- Pin the tool: `[tool.poetry] requires-poetry = ">=2.0,<3.0"`.
- Change dependencies only with `poetry add` / `poetry remove`. Dev tools go in
  a group (`poetry add --group dev pytest`), never in `project.dependencies`.
- Run everything through the project env: `poetry run pytest`, `poetry run ruff`.
- `pyproject.toml` and `poetry.lock` change in the same commit.
- CI runs `poetry check --lock --strict`, then `poetry sync`.

## Must not

- No bare Python repo: `.py` code that runs without `pyproject.toml` and
  `poetry.lock`. Stop and adopt Poetry first (skill `python-poetry`).
- No `pip install` into the project env, no global installs, no `sys.path` hacks.
- No `requirements.txt` as source of truth. Export one only as a generated
  artifact (`poetry-plugin-export`), never edited by hand.
- No `setup.py` / `setup.cfg` for metadata. No hand edits to `poetry.lock`.
- No Poetry 1.x commands: `poetry shell`, `poetry install --sync`,
  `poetry lock --no-update`.

## Exception

Stdlib-only tooling scripts inside a non-Python repo (for example the kit's
`factory/*.py`, run with `python3`) are not a Python project. The moment one
needs a third-party import, it gets a Poetry project.

## Reference

See skill: `python-poetry` for setup, migration, groups, CI, and packaging.
