<div align="center">
  <h1>Navier</h1>

  <p><strong>Durable AI agents for chat, tools and approvals, on Temporal and Postgres.</strong></p>

<a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge&labelColor=000"></a>
<a href="docs/README.md"><img alt="Read the docs" src="https://img.shields.io/badge/docs-read%20now-blue?style=for-the-badge&labelColor=000"></a>
<a href="#contributing"><img alt="Contributions welcome" src="https://img.shields.io/badge/contributions-welcome-brightgreen?style=for-the-badge&labelColor=000"></a>

</div>

Navier runs AI agents as durable conversations. A user sends a message, a worker runs the agent's turn, and the reply streams back as it is generated. A turn survives a worker restart, can pause for a human approval, and can be stopped at any point.

Everything durable lives in Postgres: threads, messages, approvals and streamed output. Temporal keeps each turn's progress, so retries, timeouts and recovery are handled by the workflow engine, not by hand-written recovery code.

## What you get

- **Durable turns.** Each user message starts one Temporal workflow. Model calls and tool calls run as activities, so each step is retried and recorded.
- **Streaming replies.** Output is written as `stream_delta` rows. Postgres `LISTEN` / `NOTIFY` wakes a server-sent-events hub that forwards them to clients.
- **Human approvals.** A tool can require approval. The turn pauses until a person approves or denies the call, or until the deadline passes.
- **Stop and interrupt.** A stop request aborts the model or tool call in flight and marks the message as stopped.
- **Pending messages.** A message sent during a running turn starts as soon as the current turn finishes.
- **Scheduled work.** Cron-style sweeps run on the same worker, with the same retry and logging rules as turns.
- **Authorization as a seam.** Every permission check goes through one interface, so the backend can change without touching agent code.

## A turn at a glance

```text
client ──HTTP──▶ API ──writes rows, starts workflow──▶ Postgres ◀── worker
  ▲                                                                  │
  └──── SSE ◀── stream hub ◀── LISTEN / NOTIFY ◀── Postgres ◀── turn workflow (Temporal)
```

Read the full picture in [Architecture](docs/architecture.md).

## Getting started

1. [Quickstart](docs/quickstart.md): run Postgres, a Temporal dev server, the worker and the API on one machine, then send a message.
2. [Building agents](docs/building-agents.md): write instructions, models, tools, approvals and schedules.
3. [Deploying workers](docs/deploying-workers.md): run the worker as a long-lived process, scale it, and roll it out safely.

The full index is in [docs/README.md](docs/README.md).

> [!NOTE]
> The docs describe the intended behavior and API shapes. Some commands and examples have not yet been checked against the source. If one fails, check the source and open an issue.

## Project status

Navier is in active development. The architecture and the turn lifecycle are documented. Setup commands, route names and tool APIs are being confirmed against the source.

## Contributing

Open an issue before a large change, so the approach can be discussed first. Pull requests should explain the problem, the change, and any behavior that changes for users. Agents and contributors working in this repository should read [AGENTS.md](AGENTS.md) first.

## License

Navier is licensed under the [Apache License, Version 2.0](LICENSE).

## Security

Please do not open public issues for security problems. Report them to the maintainer privately.
