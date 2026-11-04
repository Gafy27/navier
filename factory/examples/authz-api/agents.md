# Agents (this project)

Extra agents the host provides, beyond the kit's roles in
[`../../policy/agents.md`](../../policy/agents.md).

| User asks… | Spawn |
|------------|--------|
| Design a unit, API, or model change | `designer` |
| How does this existing slice work? | parent (`graphify`) |
| Write, review, or refactor TypeScript, Fastify, or gRPC outside a ticket SESSION | `fastify-senior-developer` |
| I/O, errors, fallbacks, swallowed failures | `silent-failure-hunter` |

Not used in this repo: `rust-senior-developer`, `react-senior-developer`,
`python-parity`. Do not spawn them.

`python3 factory/cli.py install` renders `factory/agents/` into the host
agents folder. Ticket workers are `implementer`.
