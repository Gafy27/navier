import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type { CompiledQuery, DatabaseConnection } from 'kysely';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import { parseOrgId, withTransaction } from '../../db/index.ts';
import type { Db } from '../../db/index.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import { StopWake } from '../types.ts';
import type { TurnRef } from '../types.ts';
import {
  STOP_CHANNEL,
  sendTurnMessage,
  TurnMessageKindSchema,
  wakeStop,
  WakeConfigSchema,
} from './wake.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const ref: TurnRef = {
  org: parsed.value,
  threadId: 't1',
  agentMessageId: 'm1',
};
const workflowId = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);

/** A database that delivers a statement only when its transaction commits. */
function commitOnlyDb(delivered: CompiledQuery[]): Db {
  class Driver extends DummyDriver {
    private pending: CompiledQuery[] = [];
    override acquireConnection(): Promise<DatabaseConnection> {
      return Promise.resolve({
        executeQuery: (query: CompiledQuery) => {
          this.pending.push(query);
          return Promise.resolve({ rows: [] });
        },
        streamQuery: () => {
          throw new Error('stream');
        },
      });
    }
    override beginTransaction(): Promise<void> {
      this.pending = [];
      return Promise.resolve();
    }
    override commitTransaction(): Promise<void> {
      delivered.push(...this.pending);
      return Promise.resolve();
    }
    override rollbackTransaction(): Promise<void> {
      this.pending = [];
      return Promise.resolve();
    }
  }
  return new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createIntrospector: (k: Kysely<unknown>) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
      createDriver: () => new Driver(),
    },
  });
}

void test('V1: a rolled-back stop transaction delivers no message and no notify (D1)', async () => {
  const delivered: CompiledQuery[] = [];
  const db = commitOnlyDb(delivered);
  const rolledBack = await withTransaction(db, async (tx) => {
    const woke = await wakeStop(tx, ref, StopWake.cancel);
    assert.ok(woke.ok);
    return err(appError(ErrorCode.internal, 'later statement failed'));
  });
  assert.equal(rolledBack.ok, false);
  assert.equal(delivered.length, 0);

  const committed = await withTransaction(db, async (tx) => {
    const woke = await wakeStop(tx, ref, StopWake.interrupt);
    return woke.ok ? ok(undefined) : woke;
  });
  assert.ok(committed.ok);
  assert.equal(delivered.length, 2);
  assert.match(delivered[0]?.sql ?? '', /dbos\.send_message/);
  assert.match(delivered[1]?.sql ?? '', /pg_notify/);
});

void test('PD1: both statements are parameterised and carry ids only', async () => {
  const delivered: CompiledQuery[] = [];
  await withTransaction(commitOnlyDb(delivered), async (tx) => {
    await sendTurnMessage(tx, workflowId, 'stop', 'stop:cancel');
    return ok(undefined);
  });
  const [send, notify] = delivered;
  assert.deepEqual(send?.parameters, [
    workflowId,
    JSON.stringify({ kind: 'stop' }),
    WakeConfigSchema.parse({}).topic,
    `${workflowId}:stop:cancel`,
  ]);
  assert.deepEqual(notify?.parameters, [STOP_CHANNEL, workflowId]);
});

void test('a resume message wakes the wait but sends no stop notify', async () => {
  const delivered: CompiledQuery[] = [];
  await withTransaction(commitOnlyDb(delivered), async (tx) => {
    await sendTurnMessage(tx, workflowId, 'resume', 'resume:d1');
    return ok(undefined);
  });
  assert.equal(delivered.length, 1);
});

void test('graceful needs no wake (D3)', async () => {
  const delivered: CompiledQuery[] = [];
  await withTransaction(commitOnlyDb(delivered), async (tx) => {
    assert.deepEqual(await wakeStop(tx, ref, StopWake.graceful), ok(undefined));
    return ok(undefined);
  });
  assert.deepEqual(delivered, []);
});

void test('a failed send is unavailable, so the caller rolls the stop back', async () => {
  const failing = {
    executeQuery: () => Promise.reject(new Error('fk')),
  };
  const tx = new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createIntrospector: (k: Kysely<unknown>) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
      createDriver: () =>
        new (class extends DummyDriver {
          override acquireConnection() {
            return Promise.resolve(failing as unknown as DatabaseConnection);
          }
        })(),
    },
  }) as unknown as Parameters<typeof wakeStop>[0];
  const woke = await wakeStop(tx, ref, StopWake.cancel);
  assert.ok(!woke.ok);
  assert.equal(woke.error.code, ErrorCode.unavailable);
});

void test('the message kind schema rejects anything but stop and resume', () => {
  assert.equal(TurnMessageKindSchema.safeParse('cancel').success, false);
});
