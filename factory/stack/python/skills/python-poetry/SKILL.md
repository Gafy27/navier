---
name: python-poetry
description: Poetry 2.x as the required manager for every Python project, plus basic packaging practice. Use when creating a Python project, adding or removing dependencies, touching pyproject.toml or poetry.lock, finding a bare Python repo (no pyproject.toml or no poetry.lock), migrating from requirements.txt / setup.py / pip / uv, setting up CI or Docker for Python, or building and publishing a package.
---

# Python with Poetry

Law: [`../../rules/poetry.md`](../../rules/poetry.md). This skill is the how.
Commands target Poetry 2.x (verified against 2.5.1).

## 1. Install the tool (once per machine)

```bash
pipx install poetry
poetry config virtualenvs.in-project true   # env lives in ./.venv
poetry --version
```

Never install Poetry into a project env, and never `pip install poetry` globally.

## 2. New project

```bash
poetry new my-package           # src layout by default
cd my-package
poetry add httpx                # runtime dependency
poetry add --group dev pytest ruff mypy
poetry install
poetry run pytest
```

An application that is never built as a wheel still uses Poetry. Set
`package-mode = false` under `[tool.poetry]`; omit `[build-system]`.

## 3. Adopt Poetry in a bare repo

A bare repo has runnable `.py` code but no `pyproject.toml` with a committed
`poetry.lock`. Do this before any other change:

1. `poetry init --no-interaction --name <dist-name> --python ">=3.11"`.
2. Move code under `src/<import_name>/` if it is a package. Scripts become
   functions exposed in `[project.scripts]`.
3. Re-add runtime deps from `requirements.txt` with `poetry add <pkg>`, one
   per line, keeping the minimum version that the code needs. Dev tools go to
   `--group dev`. Do not copy `==` pins; the lock file holds exact versions.
4. Delete `requirements*.txt`, `setup.py`, `setup.cfg`, `Pipfile*`.
5. `poetry install && poetry run pytest`, then commit `pyproject.toml` and
   `poetry.lock` together.

If the repo has users that still need `requirements.txt`, keep it generated:
`poetry self add poetry-plugin-export`, then
`poetry export --only main -o requirements.txt`, with a header saying so.

## 4. Daily commands

| Need | Command |
|------|---------|
| Add runtime dep | `poetry add <pkg>` |
| Add dev dep | `poetry add --group dev <pkg>` |
| Remove dep | `poetry remove <pkg>` (add `--group dev` for dev) |
| Install, keep extras already in env | `poetry install` |
| Make env match the lock exactly | `poetry sync` |
| Runtime deps only (prod) | `poetry sync --only main` |
| Run a tool | `poetry run <cmd>` |
| Activate the env | `eval $(poetry env activate)` |
| Re-lock after editing pyproject by hand | `poetry lock` (keeps existing pins) |
| Upgrade within constraints | `poetry update <pkg>` |
| Re-resolve everything | `poetry lock --regenerate` |
| See what is outdated | `poetry show --outdated --top-level` |
| Validate config and lock | `poetry check --lock --strict` |

Removed in 2.x: `poetry shell` (use `poetry env activate`), `install --sync`
(use `poetry sync`), `lock --no-update` (now the default), bundled
`poetry export` (now a plugin).

## 5. `pyproject.toml` shape

```toml
[project]
name = "my-package"
version = "0.1.0"
description = "One line saying what it does."
readme = "README.md"
requires-python = ">=3.11"
license = "MIT"
license-files = ["LICENSE"]
authors = [{ name = "Name", email = "name@example.com" }]
dependencies = [
    "httpx (>=0.27)",
]

[project.optional-dependencies]
parquet = ["pyarrow (>=15)"]

[project.scripts]
my-package = "my_package.cli:main"

[dependency-groups]
dev = [
    "pytest (>=8)",
    "ruff (>=0.6)",
    "mypy (>=1.10)",
]

[tool.poetry]
requires-poetry = ">=2.0,<3.0"

[build-system]
requires = ["poetry-core>=2.0,<3.0"]
build-backend = "poetry.core.masonry.api"
```

Tool config (`[tool.ruff]`, `[tool.mypy]`, `[tool.pytest.ini_options]`) lives
in the same file. One config file per project.

## 6. Packaging basics

- **Layout:** `src/<import_name>/`. Tests in `tests/`, outside the package.
  The src layout forces tests to run against the installed package.
- **Names:** distribution `my-package`, import `my_package`. One top-level
  import package per distribution.
- **Version:** single source is `project.version`. Read it at runtime with
  `importlib.metadata.version("my-package")`; no duplicate `__version__`.
  Follow SemVer; bump in the same commit as the changelog entry.
- **`requires-python`:** lower bound only. An upper cap breaks resolvers for
  every downstream user.
- **Dependency bounds:** libraries set a lower bound and cap a major only when
  a break is known. Applications rely on the lock file for exact versions.
- **Groups vs extras:** groups are dev-only (tests, lint, docs) and never ship.
  Optional runtime features go in `[project.optional-dependencies]`.
- **Entry points:** CLIs are `[project.scripts]`, not `python path/to/file.py`.
- **Typed packages:** ship an empty `src/<import_name>/py.typed`.
- **License:** SPDX string plus `license-files` (PEP 639), not the old table.
- **Lock file:** commit `poetry.lock` for apps and libraries alike. It pins CI
  and dev envs; it does not constrain library users.
- **Ignore:** `.venv/`, `dist/`, `__pycache__/`, `*.egg-info/`.

## 7. Build and publish

```bash
poetry build                          # dist/*.whl and dist/*.tar.gz
unzip -l dist/*.whl                   # only the package, no tests or secrets
poetry config repositories.testpypi https://test.pypi.org/legacy/
poetry publish -r testpypi            # rehearse first
poetry publish                        # then PyPI
```

Credentials come from the environment (`POETRY_PYPI_TOKEN_PYPI`,
`POETRY_PYPI_TOKEN_TESTPYPI`) or the keyring. Never write a token into
`pyproject.toml` or a committed `poetry.toml`.

## 8. CI and Docker

```bash
pipx install "poetry>=2,<3"
poetry check --lock --strict          # fails if lock is stale
poetry sync                           # exact env from the lock
poetry run ruff check . && poetry run mypy src && poetry run pytest
```

Docker: copy `pyproject.toml` and `poetry.lock` first, then
`poetry sync --only main --no-root`, then copy the source and
`poetry sync --only main`. Dependency layers stay cached across code changes.

## Review checklist

- [ ] `pyproject.toml` has `[project]`, `requires-poetry`, and `poetry-core` backend.
- [ ] `poetry.lock` is committed and `poetry check --lock --strict` passes.
- [ ] No `requirements.txt`, `setup.py`, `setup.cfg`, or `Pipfile` as a source of truth.
- [ ] Dev tools in a group, optional runtime features in extras.
- [ ] Commands in docs, Makefiles, and CI use `poetry run` / `poetry sync`.
