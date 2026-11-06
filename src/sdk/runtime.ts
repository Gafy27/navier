import { sql } from 'kysely';
import {
  appError,
  CoreConfigSchema,
  createLogger,
  ErrorCode,
  loadConfig,
} from '../index.ts';
import { createDb, DatabaseConfigSchema, parseOrgId } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import {
  connectTemporal,
  TemporalConfigSchema,
} from '../runner/temporal/index.ts';
import { deriveAgentId } from '../agents/index.ts';
import {
  AuthzConfigSchema,
  CallerConfigSchema,
  createAuthz,
  createCallerVerifier,
} from '../identity/index.ts';
import type { Caller } from '../identity/index.ts';
import {
  decide,
  messageStatusReader,
  readTurnResult,
  RuntimeConfigSchema,
  startTurn,
  Verdict,
} from '../runtime/index.ts';
import type { StartDeps } from '../runtime/index.ts';
import { runnersForTemporal } from '../runner/index.ts';
import { SdkError } from './errors.ts';
import type {
  GenerateResult,
  RuntimeSession,
  ToolCallTarget,
  DecisionOptions,
} from './session.ts';
import { awaitTurn, turnInput, unwrap } from './turn.ts';
import type { Env } from '../worker.ts';

export interface RuntimeOptions {
  readonly env: Env;
}

export interface Runtime {
  /** Verifies `authorization` (a bearer header value) and binds the caller to `org`. */
  readonly session: (input: {
    authorization: string;
    org: string;
  }) => Promise<RuntimeSession>;
  readonly close: () => Promise<void>;
}

const schema = CoreConfigSchema.extend(DatabaseConfigSchema.shape)
  .extend(TemporalConfigSchema.shape)
  .extend(RuntimeConfigSchema.shape)
  .extend(AuthzConfigSchema.shape)
  .extend(CallerConfigSchema.shape);

function loadRuntimeConfig(env: Env) {
  const merged = loadConfig(schema, env);
  if (!merged.ok) return merged;
  for (const refined of [CallerConfigSchema, AuthzConfigSchema] as const) {
    const part = loadConfig(refined, env);
    if (!part.ok) return part;
  }
  return merged;
}

const unavailable = (what: string) =>
  new SdkError(appError(ErrorCode.unavailable, `${what} is unreachable`));

async function requireDatabase(db: Db): Promise<void> {
  try {
    await sql`select 1`.execute(db);
  } catch {
    throw unavailable('database');
  }
}

/** D6 and D7: the three operations `Agent` calls, for one verified caller in one org. */
function createSession(
  deps: StartDeps,
  caller: Caller,
  org: OrgId,
): RuntimeSession {
  const decideThenWait = async (
    verdict: Verdict,
    target: ToolCallTarget,
    options: DecisionOptions,
  ): Promise<GenerateResult> => {
    const current = unwrap(
      await readTurnResult(deps, caller, org, target.runId),
    );
    unwrap(await decide(deps, caller, org, target.toolCallId, { verdict }));
    return awaitTurn(
      deps,
      caller,
      org,
      { threadId: current.threadId, agentMessageId: target.runId },
      options.abortSignal,
    );
  };
  return {
    generate: async (request) => {
      const input = unwrap(
        turnInput(
          request,
          deriveAgentId(org, request.agentKey),
          caller.principal.id,
          org,
        ),
      );
      const started = unwrap(await startTurn(deps, caller, org, input));
      return awaitTurn(
        deps,
        caller,
        org,
        { threadId: input.threadId, agentMessageId: started.agentMessageId },
        request.abortSignal,
      );
    },
    approveToolCall: (target, options) =>
      decideThenWait(Verdict.approve, target, options),
    declineToolCall: (target, options) =>
      decideThenWait(Verdict.deny, target, options),
  };
}

/**
 * D3: opens the database, authz, and Temporal handles once. It holds no tool
 * implementations and starts no worker.
 */
export async function createRuntime(options: RuntimeOptions): Promise<Runtime> {
  const config = unwrap(loadRuntimeConfig(options.env));
  const log = createLogger(config.LOG_LEVEL);
  const connected = await connectTemporal(config, log);
  if (!connected.ok) throw unavailable('temporal');
  const temporal = connected.value;
  const database = createDb(config, log);
  try {
    await requireDatabase(database.db);
  } catch (e) {
    await temporal.close();
    await database.close();
    throw e;
  }
  const deps: StartDeps = {
    db: database.db,
    authz: createAuthz(config, log),
    runners: runnersForTemporal(temporal, {
      config,
      readStatus: messageStatusReader(database.db),
    }),
    config,
    log,
  };
  const verifier = createCallerVerifier(config, log);
  return {
    session: async ({ authorization, org }) => {
      const parsedOrg = unwrap(parseOrgId(org));
      const caller = unwrap(await verifier.verify(authorization));
      return createSession(deps, caller, parsedOrg);
    },
    close: async () => {
      await temporal.close();
      await database.close();
    },
  };
}
