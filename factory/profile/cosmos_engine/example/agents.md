<!-- UNFILLED -->
# Agents (this project)

Kit dispatch: [`../../policy/agents.md`](../../policy/agents.md). Language pack:
`../stack/<project.language>/agents.md` (this example:
[`../../stack/rust/agents.md`](../../stack/rust/agents.md)). Host files live in
`.agents/agents/`. `python3 factory/cli.py install` refreshes kit agents,
appends `<paths.profile>/agent-overlays/<name>.md` when that file exists, and does
not delete this project's extras.

| User asks… | Spawn |
|------------|--------|
| Write / review / refactor in the language (not a ticket SESSION) | language-pack senior agent (rust: `rust-senior-developer`) |

Ticket implementers are `implementer`, not the language-pack senior agent.

Rewrite the extra rows. Delete `<!-- UNFILLED -->`.
