# Deploying workers

The worker runs agent turns. It is a long-lived Node.js process, and it must run on a platform that keeps a process alive. Serverless functions are not suitable: a turn can run for minutes, and the worker holds connections to Postgres and Temporal and tracks the activities it is running.

The API is different. It only accepts requests, writes rows and sends signals, so it can run anywhere, including serverless platforms.

## What the worker needs

| Requirement | Why |
|-------------|-----|
| `DATABASE_URL` | Reads and writes threads, messages and deltas. |
| `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` | Connects to the Temporal server. |
| Model and tool credentials | Used by the activities the worker runs. |
| Outbound network access | Calls the model providers and tool endpoints. |
| A long-lived process | Keeps activities running between requests. |

## Start the worker

```bash
npm run worker
```

Run it with a process supervisor in production, such as systemd, a container orchestrator, or a managed service that restarts failed processes.

## Run it in a container

A minimal Dockerfile:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "run", "worker"]
```

Pass the environment variables at run time, not in the image:

```bash
docker run -d --name navier-worker \
  -e DATABASE_URL="$DATABASE_URL" \
  -e TEMPORAL_ADDRESS="$TEMPORAL_ADDRESS" \
  -e TEMPORAL_NAMESPACE="$TEMPORAL_NAMESPACE" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  navier-worker
```

## Scale the worker

Each worker process takes activities from the task queue. To handle more turns, run more worker processes. Temporal spreads activities across them.

Limit how many turns one process runs at once. Set the concurrency in the worker configuration so that model rate limits and database connections are not exhausted by one busy process.

Turns for the same thread never run at the same time. The thread's workflow enforces this, so adding workers never causes two replies to the same thread to interleave.

## Roll out a new version

1. Deploy the new worker alongside the old one. Both connect to the same task queue.
2. Let the old workers finish their in-flight turns. Stop them with `SIGTERM`. The worker stops taking new activities and finishes the ones it has.
3. Remove the old workers once their processes exit.

Temporal records each turn's history, so a turn that started on the old version can finish on the new one. Keep workflow code changes backward-compatible until no turn started on the old version is still running. Temporal's [versioning](https://docs.temporal.io/workflows#versioning) guide covers how to do this.

## Health and shutdown

- The worker logs a line when it connects to Temporal and when it begins polling the task queue. Alert if that line does not appear after a restart.
- On `SIGTERM`, the worker stops polling, waits for running activities to finish within a grace period, then exits. Set the grace period longer than your longest model call.
- If the worker exits with activities still running, Temporal retries them on another worker after their timeout.

## Checklist before production

- [ ] Postgres has backups and the `DATABASE_URL` user has only the permissions the migrations need.
- [ ] Temporal runs with a namespace per environment, and its retention period fits your audit needs.
- [ ] Every credential comes from the platform's secret store, not from the image.
- [ ] Each worker has a process supervisor that restarts it on failure.
- [ ] The Temporal UI is reachable by the team that runs the on-call rotation.
- [ ] A test turn runs end to end in the deployed environment before real users are added.
