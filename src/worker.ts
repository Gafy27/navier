import { closeSync, openSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  appError,
  CoreConfigSchema,
  createLogger,
  err,
  ErrorCode,
  loadConfig,
  ok,
  z,
} from './index.ts';
import type { Logger, Result } from './index.ts';
import { createDb, DatabaseConfigSchema, postgresProbe } from './db/index.ts';
import { runnersForTemporal } from './runner/index.ts';
import type { Db } from './db/index.ts';
import {
  connectTemporal,
  startWorker,
  TemporalConfigSchema,
  temporalProbe,
} from './runner/temporal/index.ts';
import { HealthConfigSchema, runProcess } from './process/index.ts';
import type { HealthTools } from './process/index.ts';
import { listServingPairs, serveRegistered } from './catalog/index.ts';
import type { ServingPair } from './catalog/index.ts';
import { AuthzConfigSchema, createAuthz } from './identity/index.ts';
import { modelAdapter } from './llm/index.ts';
import type { ModelAdapter } from './llm/index.ts';
import {
  messageStatusReader,
  createToolRegistry,
  RuntimeConfigSchema,
  streamSweepActivities,
} from './runtime/index.ts';
import type { ToolRegistry } from './runtime/index.ts';
import { reaperActivities } from './runner/temporal/reaper.ts';
import { ensureReaperSchedule } from './runner/temporal/schedule.ts';
import { ensureStreamSweepSchedule } from './runner/temporal/stream-sweep-schedule.ts';
import { runtimeActivities } from './runner/temporal/activities.ts';
import type { Tool } from './sdk/tool.ts';
import { toImplementation, toToolEntryInput } from './sdk/tool.ts';

/** The variables a worker reads. `process.env` unless the caller passes its own. */
export type Env = Readonly<Record<string, string | undefined>>;

export interface WorkerOptions {
  readonly tools: readonly Tool[];
  /** The one injectable collaborator. Without it, the `llm` adapter. It holds no key. */
  readonly model?: ModelAdapter;
  readonly env?: Env;
}

export interface Worker {
  /** Resolves to the exit code once the process has shut down. */
  readonly run: () => Promise<number>;
}

const schema = CoreConfigSchema.extend(DatabaseConfigSchema.shape)
  .extend(TemporalConfigSchema.shape)
  .extend(HealthConfigSchema.shape)
  .extend(RuntimeConfigSchema.shape)
  .extend(AuthzConfigSchema.shape)
  .extend({ SECRETS_KEYS_FILE: z.string().min(1) });

const WORKFLOWS_URL = new URL('./workflows.ts', import.meta.url);

const pairLabel = (pair: ServingPair): string =>
  `${pair.key}@${String(pair.implementationVersion)}`;

/** D7: the key file must open at start. Nothing is read from it or kept. */
function checkKeyFileOpens(path: string): Result<void> {
  try {
    closeSync(openSync(path, 'r'));
  } catch {
    return err(
      appError(ErrorCode.invalid_argument, 'SECRETS_KEYS_FILE: unreadable'),
    );
  }
  return ok(undefined);
}

/**
 * D2: every pair a worker is serving or draining must be in `registry`. Checked
 * before anything is served, so a worker never serves while missing a pin.
 */
async function bootGate(
  db: Db,
  registry: ToolRegistry,
  log: Logger,
): Promise<Result<void>> {
  const listed = await listServingPairs(db);
  const missing = listed.filter(
    (pair) => registry.get(pair.key, pair.implementationVersion) === undefined,
  );
  if (missing.length === 0) return ok(undefined);
  const names = missing.map(pairLabel).join(', ');
  log.error({ missing: names }, 'boot gate: not registered');
  return err(
    appError(ErrorCode.invalid_argument, `boot gate: not registered: ${names}`),
  );
}

/**
 * PD8: `GET /tools` opens only when `WORKER_TOOLS_TOKEN` is non-empty and the
 * health host is loopback. Otherwise the endpoint is absent and nothing is built.
 */
function toolsEndpoint(
  env: Env,
  healthHost: string,
  tools: readonly Tool[],
): HealthTools | undefined {
  const token = env['WORKER_TOOLS_TOKEN'];
  if (token === undefined || token === '') return undefined;
  if (healthHost !== '127.0.0.1' && healthHost !== '::1') return undefined;
  const entries = tools.map(toToolEntryInput);
  return { token, entries: () => entries };
}

/** D1: the one worker composition. `tools` is every implementation this process holds. */
export function createWorker(options: WorkerOptions): Worker {
  const { tools, model = modelAdapter, env = process.env } = options;
  return {
    run: async () => {
      const loaded = loadConfig(schema, env);
      if (!loaded.ok) {
        createLogger('info').error(loaded.error.message);
        return 1;
      }
      const config = loaded.value;
      const log = createLogger(config.LOG_LEVEL);
      return runProcess({
        kind: 'worker',
        config,
        log,
        tools: toolsEndpoint(env, config.HEALTH_HOST, tools),
        open: async (track) => {
          const database = createDb(config, log);
          track({
            name: 'database',
            close: database.close,
            probe: postgresProbe(database.db),
          });
          const temporal = await connectTemporal(config, log);
          if (!temporal.ok) return temporal;
          track({
            name: 'temporal',
            close: temporal.value.close,
            probe: temporalProbe(temporal.value),
          });
          const keyFile = checkKeyFileOpens(config.SECRETS_KEYS_FILE);
          if (!keyFile.ok) return keyFile;
          const implementations = tools.map(toImplementation);
          const registry = createToolRegistry(implementations);
          if (!registry.ok) return registry;

          const gate = await bootGate(database.db, registry.value, log);
          if (!gate.ok) return gate;
          await serveRegistered(database.db, implementations);

          const worker = await startWorker(
            config,
            log,
            fileURLToPath(WORKFLOWS_URL),
            {
              ...runtimeActivities({
                db: database.db,
                authz: createAuthz(config, log),
                model,
                tools: registry.value,
                runners: runnersForTemporal(temporal.value, {
                  config,
                  readStatus: messageStatusReader(database.db),
                }),
                config,
                log,
              }),
              ...reaperActivities({
                db: database.db,
                temporal: temporal.value,
                config,
                log,
              }),
              ...streamSweepActivities({
                db: database.db,
                config,
              }),
            },
          );
          if (!worker.ok) return worker;
          track({ name: 'worker', close: worker.value.shutdown });
          const reaper = await ensureReaperSchedule(temporal.value, config);
          if (!reaper.ok) return reaper;
          return ensureStreamSweepSchedule(temporal.value, config);
        },
      });
    },
  };
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exit(await createWorker({ tools: [] }).run());
}
