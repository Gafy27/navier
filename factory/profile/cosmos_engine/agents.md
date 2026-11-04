# Agents (this project)

Kit dispatch: [`../policy/agents.md`](../policy/agents.md). Rust pack:
[`../stack/rust/agents.md`](../stack/rust/agents.md). Host files live in
`.agents/agents/`. `python3 factory/cli.py install` refreshes kit agents,
appends `agent-overlays/<name>.md` when that file exists, and does not
delete this project's extras.

| User asks… | Spawn |
|------------|--------|
| Write / review / refactor Rust (not a ticket SESSION) | `rust-senior-developer` |
| Does this Rust match `python-engine/`? | `python-parity` (rare; prototype is not a contract) |

Ticket implementers are `implementer`, not `rust-senior-developer`.
`python-parity` does not gate design unless a BINDING spec says so.
