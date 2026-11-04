# Agents (Rust stack)

Kit dispatch: `policy/agents.md`. Extra roles when `project.language` is `rust`.
Host file: copy [`agents/rust-senior-developer.md`](agents/rust-senior-developer.md)
into `.agents/agents/`.

| User asks… | Spawn |
|------------|--------|
| Write / review / refactor Rust (not a ticket SESSION) | `rust-senior-developer` |
| Run a `*_TICKETS.md` anexo | parent is `ticket-orchestrator`; implementers are **not** `rust-senior-developer` |
| Index / research a tree into notes | kit `policy/indexing.md`; do not spawn `rust-senior-developer` |

Ticket implementers: `implementer`. Both agents use the shared memory per
`policy/memory.md`; `rust-senior-developer` still must not run a ticket. One fresh Task per
SESSION. No `resume`.

Parent must not spawn `rust-senior-developer` as a ticket implementer.
