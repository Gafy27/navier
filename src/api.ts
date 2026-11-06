import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import {
  appError,
  CoreConfigSchema,
  createLogger,
  err,
  ErrorCode,
  loadConfig,
  ok,
} from './index.ts';
import type { Result } from './index.ts';
import { createDb, DatabaseConfigSchema, postgresProbe } from './db/index.ts';
import {
  connectTemporal,
  TemporalConfigSchema,
  temporalProbe,
} from './runner/temporal/index.ts';
import { HealthConfigSchema, runProcess } from './process/index.ts';
import {
  AuthzConfigSchema,
  CallerConfigSchema,
  createAuthz,
  createAuthzAdmin,
  createCallerVerifier,
} from './identity/index.ts';
import { createListener } from './db/index.ts';
import { createStreamHub } from './api/stream-hub.ts';
import { requireKeyFile } from './orgconfig/index.ts';
import { AgentsConfigSchema } from './agents/index.ts';
import { runnersForTemporal } from './runner/index.ts';
import {
  ADAPTER_NAMES,
  messageStatusReader,
  RuntimeConfigSchema,
} from './runtime/index.ts';
import {
  ApiConfigSchema,
  createApiApp,
  createOidcClient,
  LoginConfigSchema,
  routeList,
} from './api/index.ts';
import type { ApiConfig } from './api/index.ts';

const schema = CoreConfigSchema.extend(DatabaseConfigSchema.shape)
  .extend(TemporalConfigSchema.shape)
  .extend(HealthConfigSchema.shape)
  .extend(ApiConfigSchema.shape)
  .extend(RuntimeConfigSchema.shape);

const loaded = loadConfig(schema, process.env);
const caller = loadConfig(CallerConfigSchema, process.env);
const authzConfig = loadConfig(AuthzConfigSchema, process.env);
// Loaded on its own so the https rules of the schema stay.
const login = loadConfig(LoginConfigSchema, process.env);
const agentsConfig = loadConfig(AgentsConfigSchema, process.env);
for (const result of [loaded, caller, authzConfig, login, agentsConfig]) {
  if (!result.ok) {
    createLogger('info').error(result.error.message);
    process.exit(1);
  }
}
const okConfig = <T>(result: Result<T>): T => {
  if (!result.ok) process.exit(1);
  return result.value;
};
const config = okConfig(loaded);
const callerConfig = okConfig(caller);
const authzCfg = okConfig(authzConfig);
const loginCfg = okConfig(login);
const agentsCfg = okConfig(agentsConfig);
const log = createLogger(config.LOG_LEVEL);

/** Listens on the configured host and port. A bind failure is `unavailable`, never a throw. */
function listen(
  fetch: (req: Request) => Promise<Response>,
  api: Pick<ApiConfig, 'API_HOST' | 'API_PORT'>,
): Promise<Result<ServerType>> {
  return new Promise((resolve) => {
    const server = serve(
      { fetch, hostname: api.API_HOST, port: api.API_PORT },
      () => {
        resolve(ok(server));
      },
    );
    server.once('error', (cause) => {
      resolve(err(appError(ErrorCode.unavailable, 'api cannot listen', cause)));
    });
  });
}

const code = await runProcess({
  kind: 'api',
  config,
  log,
  open: async (track) => {
    const keyFile = requireKeyFile();
    if (!keyFile.ok) return keyFile;
    const oidc = createOidcClient(loginCfg, callerConfig.IDP_AUDIENCE);
    if (!oidc.ok) return oidc;
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
    const streamHub = createStreamHub(createListener, { config, log });
    track({ name: 'stream-hub', close: streamHub.close });
    const deps = {
      streamHub,
      db: database.db,
      runners: runnersForTemporal(temporal.value, {
        config,
        readStatus: messageStatusReader(database.db),
      }),
      authz: createAuthz(authzCfg, log),
      authzAdmin: createAuthzAdmin(authzCfg, log),
      verifier: createCallerVerifier(callerConfig, log),
      config,
      log,
      oidc: oidc.value,
      login: loginCfg,
      agentsConfig: agentsCfg,
      startConfig: config,
      adapterNames: ADAPTER_NAMES,
    };
    const server = await listen(
      createApiApp(deps, routeList(deps)).fetch,
      config,
    );
    if (!server.ok) return server;
    track({
      name: 'http',
      close: () =>
        new Promise((resolve) => {
          server.value.close(() => {
            resolve();
          });
        }),
    });
    return ok(undefined);
  },
});
process.exit(code);
