import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { sql } from 'kysely';
import { createLogger } from '../../src/index.ts';
import type { Logger } from '../../src/index.ts';
import {
  createDb,
  migrate,
  parseOrgId,
  withTransaction,
} from '../../src/db/index.ts';
import type { Db, OrgId } from '../../src/db/index.ts';
import { migrations } from '../../src/migrations.ts';
import { publishVersion } from '../../src/agents/index.ts';
import { saveAgent } from '../../src/agents/store.ts';
import {
  enableTool,
  registerTool,
  serveRegistered,
} from '../../src/catalog/index.ts';
import { parsePrincipalId, PrincipalKind } from '../../src/identity/index.ts';
import type { Caller } from '../../src/identity/index.ts';
import { ok } from '../../src/index.ts';
import { ADAPTER_NAMES } from '../../src/llm/index.ts';
import { setModelPolicy } from '../../src/models/index.ts';
import {
  setOrgConfig,
  setProvider,
  setProviderKey,
} from '../../src/orgconfig/index.ts';
import type { Runners } from '../../src/runner/index.ts';
import {
  createToolRegistry,
  decide,
  editMessage,
  requestStop,
  retryMessage,
  startTurn,
} from '../../src/runtime/index.ts';
import type { StartConfig, ToolRegistry } from '../../src/runtime/index.ts';
import { runtimeView } from '../../src/runtime/tables.ts';
import {
  allowAllAuthz,
  scriptedModel,
  scriptedTools,
  ToolKey,
} from './fakes.ts';
import type { ScriptedModel, ScriptedTools } from './fakes.ts';
import { scenarios } from './scenarios.ts';
import type { Action, MessageRows, Scenario } from './scenarios.ts';

/** What the harness gives a leg to build its runner on. */
export interface LegContext {
  readonly db: Db;
  readonly authz: ReturnType<typeof allowAllAuthz>;
  readonly model: ScriptedModel;
  readonly tools: ToolRegistry;
  readonly log: Logger;
  /** The database every leg shares for this file. */
  readonly databaseUrl: string;
  /** The service fields every runner reads; a leg adds nothing to them. */
  readonly config: Omit<StartConfig, 'TEMPORAL_ADDRESS'>;
}

/** A runner under test (D1). The harness never looks inside it (D2). */
export interface Leg {
  readonly name: 'temporal' | 'dbos';
  /** Brings the runner up. `config` is the `StartConfig` the domain functions read. */
  up(ctx: LegContext): Promise<{
    readonly runners: Runners;
    readonly config: StartConfig;
    /**
     * Optional: called while the harness waits for turns to end. A runner whose
     * pause expiry is driven by a sweep (not a timer) runs one pass here.
     */
    nudge?(): Promise<void>;
    down(): Promise<void>;
  }>;
}

const POLL_MS = 50;
const TIMEOUT_MS = 20_000;

async function until<T>(
  what: string,
  read: () => Promise<T | undefined>,
): Promise<T> {
  const deadline = Date.now() + TIMEOUT_MS;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

/** A free loopback port, for a disposable server. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/** A disposable Postgres in a container (D5). */
async function startPostgres(): Promise<{ url: string; stop: () => void }> {
  const port = await freePort();
  const name = `navier-conf-${randomUUID().slice(0, 8)}`;
  execFileSync('docker', [
    'run',
    '-d',
    '--rm',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=pw',
    '-p',
    `127.0.0.1:${String(port)}:5432`,
    'postgres:16-alpine',
  ]);
  const stop = () => {
    try {
      execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
    } catch {
      // already gone
    }
  };
  const url = `postgresql://postgres:pw@127.0.0.1:${String(port)}/postgres`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    const db = createDb(
      { DATABASE_URL: url, DATABASE_POOL_MAX: 1 },
      createLogger('silent'),
    );
    try {
      await sql`select 1`.execute(db.db);
      await db.close();
      return { url, stop };
    } catch {
      await db.close();
      if (Date.now() > deadline) {
        stop();
        throw new Error('postgres did not start');
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

/** A disposable Temporal dev server (D5). Used by the Temporal leg only. */
export async function startTemporalServer(): Promise<{
  address: string;
  stop: () => Promise<void>;
}> {
  const port = await freePort();
  const child: ChildProcess = spawn(
    'temporal',
    [
      'server',
      'start-dev',
      '--headless',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--log-level',
      'error',
      '--search-attribute',
      'OrgId=Keyword',
    ],
    { stdio: 'ignore' },
  );
  const stop = (): Promise<void> =>
    new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      child.once('exit', () => {
        resolve();
      });
      child.kill('SIGTERM');
    });
  const address = `127.0.0.1:${String(port)}`;
  const deadline = Date.now() + 40_000;
  for (;;) {
    const open = await new Promise<boolean>((resolve) => {
      const s = connect(port, '127.0.0.1');
      s.once('connect', () => {
        s.destroy();
        resolve(true);
      });
      s.once('error', () => {
        resolve(false);
      });
    });
    if (open) {
      await new Promise((r) => setTimeout(r, 1500));
      return { address, stop };
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error('temporal did not start');
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const unwrap = <T>(
  r: { ok: true; value: T } | { ok: false; error: unknown },
): T => {
  assert.ok(r.ok, `unexpected err: ${JSON.stringify(r.ok ? '' : r.error)}`);
  return r.value;
};

function mustOrg(raw: string): OrgId {
  return unwrap(parseOrgId(raw));
}

interface Seeded {
  readonly org: OrgId;
  readonly caller: Caller;
  /** The agent id for each distinct tool set. */
  readonly agents: Map<string, string>;
}

const PROVIDER = 'fake';
const MODEL_ID = 'm';
const ADAPTER = ADAPTER_NAMES[0] ?? 'openai';

function callerOf(): Caller {
  return {
    principal: {
      kind: PrincipalKind.person,
      id: unwrap(parsePrincipalId('user:conf~tester')),
    },
  } as Caller;
}

const toolEntry = (key: string, approval: string) => ({
  key,
  implementationVersion: 1,
  name: key,
  description: key,
  inputSchema: { type: 'object' },
  approval,
});

/** Org config, provider, model policy, tools and one agent per tool set the scenarios use. */
async function seed(ctx: LegContext): Promise<Seeded> {
  const { db, authz } = ctx;
  const org = mustOrg('conf-org');
  const caller = callerOf();
  unwrap(
    await setOrgConfig(authz, db, caller, org, {
      maxToolsPerVersion: 10,
      maxFallbacks: 2,
      maxSteps: 10,
      pauseTimeout: '3s',
      maxTraceOutputBytes: 100_000,
      maxToolOutputBytes: 100_000,
      maxToolAttempts: 1,
    }),
  );
  unwrap(
    await setProvider(
      authz,
      db,
      caller,
      org,
      { provider: PROVIDER, adapter: ADAPTER, baseUrl: 'http://127.0.0.1:1' },
      ADAPTER_NAMES,
    ),
  );
  unwrap(
    await setProviderKey(
      authz,
      db,
      caller,
      org,
      PROVIDER,
      'k',
      () => Promise.resolve(ok(undefined)),
      new AbortController().signal,
    ),
  );
  unwrap(
    await setModelPolicy(authz, db, caller, org, {
      provider: PROVIDER,
      model: MODEL_ID,
      enabled: true,
      degraded: false,
    }),
  );
  const entries = [
    toolEntry(ToolKey.echo, 'never_ask'),
    toolEntry(ToolKey.gated, 'high'),
    toolEntry(ToolKey.hang, 'never_ask'),
  ];
  unwrap(
    await withTransaction(db, async (tx) => {
      for (const entry of entries) {
        unwrap(await registerTool(tx, {}, org, entry, caller.principal));
      }
      return ok(undefined);
    }),
  );
  for (const entry of entries) {
    unwrap(await enableTool(authz, db, caller, org, entry.key, 1, true));
  }
  await serveRegistered(
    db,
    entries.map((e) => ({ key: e.key, implementationVersion: 1 })),
  );

  const agents = new Map<string, string>();
  for (const tools of new Set(scenarios.map((s) => s.tools.join(',')))) {
    const saved = unwrap(
      await saveAgent({ db, authz, config: {} }, caller, org, {
        idempotencyKey: `conf-${tools === '' ? 'none' : tools}`,
        document: {
          name: `conf ${tools === '' ? 'none' : tools}`,
          instructions: 'Answer.',
          model: { provider: PROVIDER, model: MODEL_ID, reasoningEffort: null },
          tools:
            tools === ''
              ? []
              : tools
                  .split(',')
                  .map((key) => ({ key, implementationVersion: 1 })),
          memory: {
            workingMemoryScope: 'thread',
            messageHistory: { maxMessages: 20 },
          },
          limits: { toolCallConcurrency: 2 },
        },
      }),
    );
    unwrap(
      await publishVersion(
        { db, authz },
        caller,
        org,
        saved.id,
        saved.version,
        {
          space: 'conf',
        },
      ),
    );
    agents.set(tools, saved.id);
  }
  return { org, caller, agents };
}

/** Rows of one agent message, reduced to what D2 allows. */
async function rowsOf(
  db: Db,
  org: OrgId,
  messageId: string,
): Promise<MessageRows> {
  const q = runtimeView(db);
  const statuses = await q
    .selectFrom('message_status')
    .select(['status', 'reason'])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .orderBy('seq')
    .execute();
  const actions = await q
    .selectFrom('action')
    .select(['id', 'tool_key'])
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .orderBy('step_index')
    .orderBy('call_index')
    .execute();
  const perAction = [];
  for (const action of actions) {
    const rows = await q
      .selectFrom('action_status')
      .select(['status', 'reason'])
      .where('org_id', '=', org)
      .where('action_id', '=', action.id)
      .orderBy('seq')
      .execute();
    perAction.push({
      tool: action.tool_key,
      statuses: rows.map(labelOf),
    });
  }
  const steps = await q
    .selectFrom('step')
    .select('step_index')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .execute();
  const deltas = await q
    .selectFrom('stream_delta')
    .select('seq')
    .where('org_id', '=', org)
    .where('message_id', '=', messageId)
    .execute();
  return {
    statuses: statuses.map(labelOf),
    actions: perAction,
    steps: steps.length,
    deltas: deltas.length,
  };
}

function labelOf(row: { status: string; reason: string | null }): string {
  return row.reason === null ? row.status : `${row.status}:${row.reason}`;
}

const TERMINAL = new Set([
  'succeeded',
  'errored',
  'cancelled',
  'interrupted',
  'gracefully_stopped',
  'max_steps',
  'expired',
]);

async function agentMessageIds(
  db: Db,
  org: OrgId,
  threadId: string,
): Promise<string[]> {
  const rows = await runtimeView(db)
    .selectFrom('message')
    .select('id')
    .where('org_id', '=', org)
    .where('thread_id', '=', threadId)
    .where('role', '=', 'agent')
    .orderBy('rank')
    .execute();
  return rows.map((r) => r.id);
}

/** Runs one scenario through the public domain functions and returns the rows (D2). */
async function drive(
  s: Scenario,
  parts: {
    ctx: LegContext;
    seeded: Seeded;
    runners: Runners;
    config: StartConfig;
    tools: ScriptedTools;
    nudge: (() => Promise<void>) | undefined;
  },
): Promise<MessageRows[]> {
  const { ctx, seeded, runners, config, tools, nudge } = parts;
  const { db, authz, log, model } = ctx;
  const { org, caller } = seeded;
  const agentId = seeded.agents.get(s.tools.join(','));
  assert.ok(agentId);
  const deps = { db, authz, runners, config, log };
  model.load(s.model);
  tools.reset();

  const threadId = randomUUID();
  const userMessageId = randomUUID();
  const agentMessageId = randomUUID();
  const started = unwrap(
    await startTurn(deps, caller, org, {
      threadId,
      agentId,
      agentMessageId,
      userMessage: { id: userMessageId, text: 'hello' },
      requestContext: {},
      ...(s.maxSteps === undefined ? {} : { maxSteps: s.maxSteps }),
    }),
  );
  assert.equal(started.kind, 'started');

  const settle = async () => {
    try {
      await settleOnce();
    } catch (e) {
      const ids = await agentMessageIds(db, org, threadId);
      const rows = await Promise.all(ids.map((id) => rowsOf(db, org, id)));
      throw new Error(`${String(e)}: ${JSON.stringify(rows)}`);
    }
  };
  const settleOnce = async () => {
    await until('every agent message terminal', async () => {
      await nudge?.();
      const ids = await agentMessageIds(db, org, threadId);
      for (const id of ids) {
        const newest = await runtimeView(db)
          .selectFrom('message_status')
          .select('status')
          .where('org_id', '=', org)
          .where('message_id', '=', id)
          .orderBy('seq', 'desc')
          .limit(1)
          .executeTakeFirst();
        if (newest === undefined || !TERMINAL.has(newest.status))
          return undefined;
      }
      return true;
    });
  };

  let lastMessage: string = agentMessageId;
  const blockedAction = () =>
    until('a blocked action', async () => {
      const row = await sql<{ id: string }>`
        select a.id from action a
        where a.org_id = ${org} and a.message_id = ${agentMessageId}
          and (select s.status from action_status s
               where s.org_id = a.org_id and s.action_id = a.id
               order by s.seq desc limit 1) = 'blocked'
          and (select m.status from message_status m
               where m.org_id = a.org_id and m.message_id = a.message_id
               order by m.seq desc limit 1) = 'paused'
        limit 1`.execute(db);
      return row.rows[0]?.id;
    });

  const run = async (a: Action): Promise<void> => {
    if ('waitModel' in a) return model.called(a.waitModel);
    if ('waitHang' in a) return tools.hanging(a.waitHang);
    if ('waitBlocked' in a) {
      await blockedAction();
      return;
    }
    if ('stop' in a) {
      unwrap(
        await requestStop(
          { db, authz, runners },
          caller,
          org,
          agentMessageId,
          a.stop,
        ),
      );
      return;
    }
    if ('decide' in a) {
      const id = await blockedAction();
      unwrap(await decide(deps, caller, org, id, { verdict: a.decide }));
      return;
    }
    if ('postWhileRunning' in a) {
      const second = unwrap(
        await startTurn(deps, caller, org, {
          threadId,
          agentId,
          agentMessageId: randomUUID(),
          userMessage: { id: randomUUID(), text: a.postWhileRunning },
          requestContext: {},
        }),
      );
      assert.equal(second.kind, 'pending');
      return;
    }
    if ('release' in a) {
      model.release();
      return;
    }
    if ('settle' in a) return settle();
    if ('edit' in a) {
      const edited = unwrap(
        await editMessage(deps, caller, org, threadId, userMessageId, {
          text: a.edit,
        }),
      );
      lastMessage = edited.agentMessageId;
      return;
    }
    const retried = unwrap(
      await retryMessage(deps, caller, org, threadId, lastMessage, {
        idempotencyKey: randomUUID(),
      }),
    );
    lastMessage = retried.agentMessageId;
  };

  for (const action of s.actions) await run(action);
  await settle();
  const ids = await agentMessageIds(db, org, threadId);
  return Promise.all(ids.map((id) => rowsOf(db, org, id)));
}

/**
 * Registers S1–S12 for `leg` (D1). The suite is the same for every runner: it
 * asserts the rows a scenario leaves and nothing of the runner (D2).
 */
export function defineConformance(leg: Leg, only?: readonly string[]): void {
  void describe(`conformance: ${leg.name}`, () => {
    let postgres: { url: string; stop: () => void } | undefined;
    let closeDb: (() => Promise<void>) | undefined;
    let keyDir: string | undefined;
    let ctx: LegContext;
    let seeded: Seeded;
    let tools: ScriptedTools;
    let running: Awaited<ReturnType<Leg['up']>> | undefined;

    before(async () => {
      const db = await startPostgres();
      postgres = db;
      keyDir = mkdtempSync(join(tmpdir(), 'conformance-'));
      const keyFile = join(keyDir, 'keys.json');
      writeFileSync(
        keyFile,
        JSON.stringify({
          current: 'k1',
          keys: { k1: Buffer.alloc(32, 7).toString('base64') },
        }),
      );
      /* eslint-disable no-restricted-syntax -- the harness is a test entrypoint */
      process.env['SECRETS_KEYS_FILE'] = keyFile;
      process.env['NODE_ENV'] = 'test';
      const log = createLogger(
        process.env['CONFORMANCE_LOG'] === undefined ? 'error' : 'debug',
      );
      /* eslint-enable no-restricted-syntax */
      const database = createDb(
        { DATABASE_URL: db.url, DATABASE_POOL_MAX: 10 },
        log,
      );
      closeDb = database.close;
      unwrap(await migrate(database.db, migrations, log));
      tools = scriptedTools();
      const registry = unwrap(createToolRegistry(tools.implementations));
      ctx = {
        db: database.db,
        authz: allowAllAuthz(),
        model: scriptedModel(),
        tools: registry,
        log,
        databaseUrl: db.url,
        config: {
          LOG_LEVEL: 'error',
          SHUTDOWN_TIMEOUT_MS: 5000,
          START_GRACE_MS: 2_000,
          MODEL_CALL_TIMEOUT_MS: 20_000,
          MODEL_ATTEMPTS: 1,
          TOOL_CALL_TIMEOUT_MS: 20_000,
          STORE_CALL_TIMEOUT_MS: 20_000,
          REAPER_INTERVAL_MS: 3_600_000,
          REAPER_BATCH_SIZE: 10,
          STREAM_SWEEP_INTERVAL_MS: 3_600_000,
          STREAM_SWEEP_BATCH_SIZE: 10,
          TEMPORAL_NAMESPACE: 'default',
          TEMPORAL_TASK_QUEUE: `conf-${randomUUID().slice(0, 8)}`,
        },
      };
      seeded = await seed(ctx);
      running = await leg.up(ctx);
    });

    after(async () => {
      await running?.down();
      await closeDb?.();
      postgres?.stop();
      if (keyDir !== undefined)
        rmSync(keyDir, { recursive: true, force: true });
    });

    for (const s of scenarios) {
      if (only !== undefined && !only.includes(s.id)) continue;
      void test(`${s.id} ${s.title}`, async () => {
        assert.ok(running);
        const leg = running;
        const rows = await drive(s, {
          ctx,
          seeded,
          runners: leg.runners,
          config: leg.config,
          tools,
          nudge: leg.nudge?.bind(leg),
        });
        assert.deepEqual(rows, s.rows);
      });
    }
  });
}
