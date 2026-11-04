# Code style (this project)

Language rules: [`../../stack/typescript/code-style.md`](../../stack/typescript/code-style.md).

- Keep Navier's conventions: `Result<T>` returns with `ErrorCode`, zod at
  boundaries, `import type`, const objects instead of enums, design ids in
  comments (`D4`, `PD1`).
- Workflow code under `src/runner/dbos/` is deterministic: no clock, random,
  IO or env reads outside steps (P2.1 laws).
- Step outputs are ids and small enums (P2.1).
- No new comment that names a runner inside `src/runtime/`.
