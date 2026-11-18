# Navier documentation

Navier runs AI agents as durable conversations. A user sends a message, a worker runs the agent's turn, and the reply streams back as it is generated. A turn survives a worker restart, can wait for a human approval, and can be stopped at any point.

Start with the [quickstart](quickstart.md) to run Navier on your machine in a few minutes. Then read the rest in this order:

| Guide | What it covers |
|-------|----------------|
| [Quickstart](quickstart.md) | Run Postgres, Temporal and Navier locally, and send your first message. |
| [Architecture](architecture.md) | How a turn flows through the API, the worker, Postgres and the stream. |
| [Building agents](building-agents.md) | Instructions, model adapters, tools, approvals and scheduled work. |
| [Deploying workers](deploying-workers.md) | Run the worker as a long-lived process, scale it, and roll it out safely. |

## Core ideas

- **A turn is a workflow.** Each user message starts one Temporal workflow. The workflow calls the model and the tools as activities, so each step is retried and recorded.
- **Postgres is the source of truth.** Messages, threads, approvals and streamed deltas are rows. A worker can crash at any time, and the database still says what happened.
- **Streaming is a table.** Model output is written as `stream_delta` rows. Postgres `LISTEN` / `NOTIFY` wakes the server-sent-events hub, which forwards them to the browser or SDK client.
- **Approvals pause, they don't block.** When a tool needs a human decision, the turn waits. The decision arrives as a signal or as a row, and the turn resumes.
- **Authorization is a seam.** Every permission check goes through one interface, so the authorization backend can change without touching agent code.

## Glossary

| Term | Meaning |
|------|---------|
| Organization (`org`) | The tenant. Every row and every check is scoped to one org. |
| Thread | A conversation. One thread runs at most one turn at a time. |
| Message | A user or agent entry in a thread. |
| Turn | The work the agent does for one user message, including its tool calls. |
| Pending message | A message sent while a turn is still running. It starts a turn once the current one finishes. |
| Approval | A pause in a turn, waiting for a person to approve or deny a tool call. |
| Stop | A request to end a turn. The worker aborts the running model or tool call. |
| Delta | One piece of streamed output, stored in `stream_delta`. |
| Worker | The long-lived process that runs turn workflows and activities. |
