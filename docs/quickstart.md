# Quickstart

This guide runs Navier on one machine: Postgres for data, a Temporal dev server for workflows, a worker that runs turns, and the API that accepts messages and streams replies.

Estimated time: 10 minutes.

## Prerequisites

- Node.js 20 or later, and npm or pnpm
- Docker, to run Postgres
- The [Temporal CLI](https://docs.temporal.io/cli), to run a local Temporal server
- Git, to clone the repository

## 1. Start Postgres

```bash
docker run -d --name navier-pg \
  -e POSTGRES_PASSWORD=navier \
  -e POSTGRES_DB=navier \
  -p 5432:5432 \
  postgres:17
```

Check that it accepts connections:

```bash
docker exec navier-pg pg_isready -U postgres
```

## 2. Start the Temporal dev server

In a second terminal:

```bash
temporal server start-dev
```

The server listens on `localhost:7233` and serves its web UI on `http://localhost:8233`. The UI shows every turn workflow as it runs, which is the easiest way to watch a turn.

## 3. Configure the environment

Create `.env` in the repository root:

```bash
DATABASE_URL=postgres://postgres:navier@localhost:5432/navier
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

Model credentials depend on the model adapter you use. Add its key here, for example `OPENAI_API_KEY=...`.

## 4. Install and migrate

```bash
git clone <repository-url> navier
cd navier
npm install
```

Apply the database migrations before the first run. The migration command is the one defined in the repository's `package.json` scripts. Check the scripts with `npm run` and use the migrate entry.

## 5. Start the worker

The worker runs turns. Keep it running in its own terminal:

```bash
npm run worker
```

The worker connects to Temporal and polls the turn task queue. Without it, messages are stored but nothing runs them.

## 6. Start the API

In a third terminal:

```bash
npm run api
```

The API listens on `http://localhost:3000` by default.

## 7. Send a message and stream the reply

Create a thread and send a message:

```bash
curl -s -X POST http://localhost:3000/v1/threads \
  -H "content-type: application/json" \
  -d '{"org": "demo", "title": "First chat"}'
```

Copy the `id` from the response, then post a message to that thread:

```bash
curl -N -X POST http://localhost:3000/v1/threads/<thread-id>/messages \
  -H "content-type: application/json" \
  -d '{"org": "demo", "text": "Say hello and tell me what you can do."}'
```

The reply arrives as server-sent events. Each `delta` event carries a piece of text, and a `turn.completed` event closes the stream.

## Check that it worked

- The Temporal UI at `http://localhost:8233` shows one completed workflow for the message.
- `SELECT count(*) FROM stream_delta;` in Postgres returns more than zero.
- The worker log shows the turn start and finish.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| `ECONNREFUSED 5432` | Postgres is not running, or the port is taken. |
| `ECONNREFUSED 7233` | The Temporal dev server is not running. |
| The message is stored, but no reply arrives | The worker is not running, or it is on a different task queue. |
| `401` or `403` from the API | The request has no valid identity for the org. Check the auth headers. |
| The model step fails at once | The model key is missing from `.env`. |

## Next steps

- [Building agents](building-agents.md) to write instructions and tools.
- [Deploying workers](deploying-workers.md) before you run Navier anywhere other than your laptop.
