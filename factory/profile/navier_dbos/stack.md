# Stack

| Technology | Owner | Why |
|------------|-------|-----|
| TypeScript on Node (type stripping, `.ts` imports) | all of `src/` | Navier's existing stack |
| Kysely + `pg` | `src/db/` | Existing; DBOS `KyselyDataSource` only if a transaction step is chosen (P2.5) |
| DBOS Transact TS `@dbos-inc/dbos-sdk` 5.4.x (MIT) | `src/runner/dbos/` | Durable workflows, queues, schedules, messages |
| Postgres (same database; DBOS system schema `dbos`) | `src/db/`, DBOS | One stateful dependency for the runner |
| Temporal TS SDK (frozen) | `src/runner/temporal/` | Frozen adapter, drain only |
| authz-engine (owner's design) | `src/authz/engine/` | Five-verb SDK, transaction-bound identity |
| Navier `llm/` ModelAdapter (unchanged) | `src/llm/` | Anthropic + OpenRouter |
| OpenTelemetry (via DBOS tracing) | `src/runner/dbos/trace.ts` | Replaces Temporal interceptors |
