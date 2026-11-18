# Architecture

Navier has three processes and one database.

```text
 client ──HTTP──▶ API ──writes rows, starts workflow──▶ Postgres ◀──reads/writes── worker
   ▲                                                      │                        │
   └────────── SSE ◀── stream hub ◀── LISTEN / NOTIFY ◀───┘                        │
                                                                                    ▼
                                                              Temporal server ◀── turn workflow
```

- **API.** Accepts threads, messages, edits and stop requests. It writes rows and starts or signals the turn workflow. It also serves the event stream.
- **Worker.** Runs turn workflows and their activities: model calls, tool calls and approval waits. It can run many turns at once, one per thread.
- **Postgres.** Holds every durable fact: threads, messages, turn state, approvals, tool results and streamed deltas.
- **Temporal.** Keeps each turn's workflow history, schedules retries and timeouts, and delivers signals to running turns.

## A turn, step by step

1. **Accept.** The API inserts the user message and an agent message row in one transaction. The agent message starts as `pending`.
2. **Start.** The API starts the turn workflow with an ID built from the org, thread and message. The ID makes a second start for the same message a no-op.
3. **Load.** The workflow loads the thread, the agent's instructions and the message history from Postgres.
4. **Model.** The model activity calls the model adapter and writes each chunk as a `stream_delta` row. The stream hub forwards each row to connected clients. Retries and timeouts apply here.
5. **Tools.** If the model asks for tools, each tool runs as its own activity, in the order the model requested. A tool whose authorization check fails is recorded as denied and does not run.
6. **Approve.** A tool marked for approval makes the turn wait. The turn stays paused until a decision signal arrives or the approval deadline passes.
7. **Loop.** The workflow repeats steps 4 to 6 until the model stops asking for tools.
8. **Finish.** The workflow marks the agent message complete and starts the next pending message in the thread, if there is one.

## Stop and interrupt

A stop request writes a `stop_requested` flag and sends a signal to the workflow. The worker cancels the running activity, so the model stream ends early. The agent message is then marked stopped with whatever text was produced.

An interrupt works the same way, but the next pending message starts right after the stop.

## The stream

Deltas are append-only rows in `stream_delta`, keyed by message and sequence number. Clients reconnect with the last sequence number they saw, and the stream replays from there. Because the rows live in Postgres, a worker restart does not lose streamed output.

## Where state lives

| State | Where | Why |
|-------|-------|-----|
| Threads, messages, approvals | Postgres | Queried and shown in the UI. |
| Streamed output | `stream_delta` in Postgres | Replayable and shared across API replicas. |
| Turn progress, retries, timers | Temporal workflow history | Recovered automatically after a crash. |
| Model and tool outputs | Postgres rows, referenced from the workflow | Large payloads stay out of the workflow history. |

## Authorization

Every check goes through the `NavierAuthz` interface. The default implementation calls the authorization service over gRPC. Callers never reach the service directly, so the implementation can change without touching agent code.

## Failure handling

| Failure | What happens |
|---------|--------------|
| Worker crashes mid-turn | Temporal retries the interrupted activity on another worker. Completed steps are not repeated. |
| Model call times out | The activity retries under its retry policy, then the turn records a failure. |
| Tool throws | The error is recorded as the tool result, and the model sees it on the next step. |
| API crashes after writing rows | The rows are committed. The workflow start is retried from the stored message. |
| Approval never arrives | The approval expires at its deadline and the turn ends with a clear reason. |
