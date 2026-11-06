import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { ApplicationFailure } from '@temporalio/common';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type { CompiledQuery, DatabaseConnection } from 'kysely';
import { parseOrgId } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Authz } from '../identity/index.ts';
import type { ModelAdapter } from '../llm/index.ts';
import { runtimeActivities } from '../runner/temporal/activities.ts';
import type { RuntimeActivityDeps } from '../runner/temporal/activities.ts';
import { StopAbort } from '../runner/dbos/steps.ts';
import { runTurn } from '../runner/dbos/workflow.ts';
import type { End, TurnPorts } from '../runner/dbos/workflow.ts';
import { MessageStatus } from './status.ts';
import { createTurnSteps } from './steps.ts';
import { createToolRegistry } from './tools.ts';

const db: Db = new Kysely({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (k) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const org: OrgId = parsed.value;

const tools = createToolRegistry([]);
assert.ok(tools.ok);

const promoted: string[] = [];
const stepDeps = {
  db,
  authz: {} as Authz,
  model: {} as ModelAdapter,
  tools: tools.value,
  startPromoted: (_org: OrgId, id: string) => {
    promoted.push(id);
    return Promise.resolve();
  },
};

function activities() {
  return runtimeActivities({
    ...stepDeps,
    temporal: {},
    config: {},
    log: {},
  } as unknown as RuntimeActivityDeps);
}

const missingTurn = { org, agentMessageId: 'm1' } as const;
const missingTurnWire = { org: 'org-a', agentMessageId: 'm1' } as const;

void test('loadTurn missing message: Result failure and activity maps to ApplicationFailure', async () => {
  const steps = createTurnSteps(stepDeps);
  const result = await steps.loadTurn(missingTurn);
  assert.ok(!result.ok);
  const { code, message } = result.error;
  await assert.rejects(
    activities().loadTurn(missingTurnWire),
    (e: unknown) =>
      e instanceof ApplicationFailure &&
      e.type === code &&
      e.message === message,
  );
});

void test('V2: a bad activity argument never reaches the step and never retries', async () => {
  await assert.rejects(
    activities().loadTurn({ org: '', agentMessageId: 'm1' }),
    (e: unknown) => e instanceof ApplicationFailure && e.nonRetryable,
  );
});

void test('finishTurn starts nothing when the close promoted nothing', async () => {
  promoted.length = 0;
  const result = await createTurnSteps(stepDeps).finishTurn({
    org,
    agentMessageId: 'm1',
    status: 'succeeded',
    reason: null,
  });
  assert.ok(result.ok);
  assert.equal(result.value.promotedAgentMessageId, undefined);
  assert.deepEqual(promoted, []);
});

void test('steps.ts imports no runner SDK', async () => {
  const source = await readFile(new URL('./steps.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /@temporalio|@dbos-inc/);
});

/** A database that answers the stop row read and the open pending read from fixed rows. */
function boundaryDb(rows: {
  readonly stop?: 'cancel' | 'interrupt';
  readonly pending: boolean;
}): Db {
  class Driver extends DummyDriver {
    override acquireConnection(): Promise<DatabaseConnection> {
      return Promise.resolve({
        executeQuery: (query: CompiledQuery) => {
          if (query.sql.includes('"stop_requested"')) {
            return Promise.resolve({
              rows: rows.stop === undefined ? [] : [{ kind: rows.stop }],
            });
          }
          return Promise.resolve({
            rows: rows.pending ? [{ user_message_id: 'u1', rank: 1 }] : [],
          });
        },
        streamQuery: () => {
          throw new Error('stream');
        },
      } as unknown as DatabaseConnection);
    }
  }
  return new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new Driver(),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
}

const boundaryArgs = { org, agentMessageId: 'm1', threadId: 't1' };

async function boundary(rows: Parameters<typeof boundaryDb>[0]) {
  const result = await createTurnSteps({
    ...stepDeps,
    db: boundaryDb(rows),
  }).checkStop(boundaryArgs);
  assert.ok(result.ok);
  return result.value;
}

void test('D3: checkStop reads the stop row first, then an open pending message', async () => {
  assert.equal(await boundary({ stop: 'cancel', pending: true }), 'cancel');
  assert.equal(
    await boundary({ stop: 'interrupt', pending: false }),
    'interrupt',
  );
  assert.equal(await boundary({ pending: true }), 'graceful');
  assert.equal(await boundary({ pending: false }), 'none');
});

/** Ports for a run that pauses on its first model step; `stops` answers each checkStop in order. */
function pausedRun(
  stops: readonly ('none' | 'cancel' | 'interrupt' | 'graceful')[],
  wait: 'resume' | 'expired',
  over: Partial<TurnPorts> = {},
) {
  const finished: End[] = [];
  const queue = [...stops];
  const ports: TurnPorts = {
    workflowId: 'wf1',
    loadTurn: () =>
      Promise.resolve({
        kind: 'run',
        nextStep: 0,
        pending: [],
        maxSteps: 3,
        toolCallConcurrency: 1,
        waiting: false,
      }),
    currentStatus: () => Promise.resolve(MessageStatus.succeeded),
    checkStop: () => Promise.resolve(queue.shift() ?? 'none'),
    modelStep: () =>
      Promise.resolve({ runnable: [], done: false, waiting: true }),
    toolPool: () => Promise.resolve(false),
    pauseTurn: () => Promise.resolve({ pausedSeq: 1, expiresAtEpochMs: 9 }),
    waitForDecision: () => Promise.resolve(wait),
    finishTurn: (end) => {
      finished.push(end);
      return Promise.resolve();
    },
    setStatus: () => Promise.resolve(),
    ...over,
  };
  return { ports, finished };
}

void test('V3 (L1): a stop committed in the same wait as a decision ends the turn, not resumes it', async () => {
  const resumed = pausedRun(['none', 'cancel'], 'resume');
  assert.equal(await runTurn(resumed.ports), MessageStatus.cancelled);
  assert.deepEqual(resumed.finished, [{ status: 'cancelled', reason: null }]);

  const expired = pausedRun(['none', 'interrupt'], 'expired');
  assert.equal(await runTurn(expired.ports), MessageStatus.interrupted);
});

void test('a decision with no stop row still resumes, and an expiry still expires (L1)', async () => {
  const expired = pausedRun(['none', 'none'], 'expired');
  assert.equal(await runTurn(expired.ports), MessageStatus.expired);
  const resumed = pausedRun(['none', 'none', 'none'], 'resume', {
    modelStep: (() => {
      let calls = 0;
      return () => {
        calls += 1;
        return Promise.resolve(
          calls === 1
            ? { runnable: [], done: false, waiting: true }
            : { runnable: [], done: true },
        );
      };
    })(),
  });
  assert.equal(await runTurn(resumed.ports), MessageStatus.succeeded);
});

void test('D4: a StopAbort from a model step or a tool pool ends as the stop row says', async () => {
  const model = pausedRun(['none', 'interrupt'], 'resume', {
    modelStep: () => Promise.reject(new StopAbort()),
  });
  assert.equal(await runTurn(model.ports), MessageStatus.interrupted);

  const pool = pausedRun(['cancel'], 'resume', {
    toolPool: () => Promise.reject(new StopAbort()),
  });
  assert.equal(await runTurn(pool.ports), MessageStatus.cancelled);
  assert.equal(pool.finished.length, 1);
});

void test('D4: a StopAbort with no stop row is a workflow failure, not a stop', async () => {
  const run = pausedRun(['none', 'none'], 'resume', {
    modelStep: () => Promise.reject(new StopAbort()),
  });
  assert.equal(await runTurn(run.ports), MessageStatus.errored);
  assert.deepEqual(run.finished, [
    { status: 'errored', reason: 'workflow_failed' },
  ]);
});
