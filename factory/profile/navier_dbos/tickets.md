# Tickets (this project)

Stack fences: [`../../stack/typescript/tickets.md`](../../stack/typescript/tickets.md).

- Tickets edit the **Navier repository** (`src/...` paths), never this design
  repository and never `/workspace/attach/navier` (read-only copy).
- Every `commands.*` gate is empty here; a Green-when line naming one is
  **unavailable** and the ticket reports blocked, never green.
- `{unit}` in `commands.test_scope` is a Navier folder (`src/runner/dbos`).
- Never edit `src/runner/temporal/` except the P1.3 move ticket (frozen law).
- Never touch `src/llm/` (owner decision 2).
