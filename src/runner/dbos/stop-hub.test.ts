import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import type { CompiledQuery, DatabaseConnection } from 'kysely';
import type { Logger } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import type { Db } from '../../db/index.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';
import {
  createStopHub,
  StopHubConfigSchema,
  type ListenerEvents,
} from './stop-hub.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const org = parsed.value;
const wf1 = turnWorkflowId(org, 't1', 'm1');
const wf2 = turnWorkflowId(org, 't1', 'm2');
const { pollIntervalMs } = StopHubConfigSchema.parse({});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

/** `stopped` is the set of message ids with a committed stop row. */
function fixture(stopped: Set<string>, failScan = false) {
  const queries: CompiledQuery[] = [];
  const warned: string[] = [];
  class Driver extends DummyDriver {
    override acquireConnection(): Promise<DatabaseConnection> {
      return Promise.resolve({
        executeQuery: (query: CompiledQuery) => {
          queries.push(query);
          if (failScan) return Promise.reject(new Error('down'));
          return Promise.resolve({
            rows: [...stopped].map((message_id) => ({
              org_id: org,
              message_id,
            })),
          });
        },
        streamQuery: () => {
          throw new Error('stream');
        },
      } as unknown as DatabaseConnection);
    }
  }
  const db = new Kysely({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createIntrospector: (k: Kysely<unknown>) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
      createDriver: () => new Driver(),
    },
  }) as unknown as Db;
  let events: ListenerEvents | undefined;
  let closed = 0;
  const log = {
    warn: (_fields: unknown, message: string) => warned.push(message),
  } as unknown as Logger;
  const hub = createStopHub(
    db,
    (e) => {
      events = e;
      return {
        close: () => {
          closed += 1;
          return Promise.resolve();
        },
      };
    },
    log,
  );
  return {
    hub,
    queries,
    warned,
    closedCount: () => closed,
    events: () => {
      assert.ok(events);
      return events;
    },
  };
}

void test('V2: a stop missed while the listener was down aborts on reconnect (D2)', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const stopped = new Set<string>();
    const f = fixture(stopped);
    const step = f.hub.register(wf1);
    f.events().onUp();
    f.events().onDown();
    stopped.add('m1'); // committed while no LISTEN: the notification is lost
    assert.equal(step.signal.aborted, false);
    f.events().onUp();
    await settle();
    assert.equal(step.signal.aborted, true);
    f.hub.register(wf2).release();
    await f.hub.close();
  } finally {
    mock.timers.reset();
  }
});

void test('D7: while the listener is down the hub polls and stops polling once up', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const stopped = new Set<string>();
    const f = fixture(stopped);
    const step = f.hub.register(wf1);
    stopped.add('m1');
    mock.timers.tick(pollIntervalMs);
    await settle();
    assert.equal(step.signal.aborted, true);

    const other = f.hub.register(wf2);
    f.events().onUp();
    await settle();
    const seen = f.queries.length;
    mock.timers.tick(pollIntervalMs * 3);
    await settle();
    assert.equal(f.queries.length, seen);
    other.release();
    await f.hub.close();
  } finally {
    mock.timers.reset();
  }
});

void test('a notification aborts only the workflow it names; release unregisters', async () => {
  const f = fixture(new Set());
  const a = f.hub.register(wf1);
  const b = f.hub.register(wf2);
  const second = f.hub.register(wf1);
  f.events().onPayload(wf1);
  assert.deepEqual(
    [a.signal.aborted, second.signal.aborted, b.signal.aborted],
    [true, true, false],
  );
  b.release();
  f.events().onPayload(wf2);
  assert.equal(b.signal.aborted, false);
  await f.hub.close();
});

void test('a failed re-read logs and the next one still runs', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const f = fixture(new Set(), true);
    f.hub.register(wf1);
    mock.timers.tick(pollIntervalMs);
    await settle();
    mock.timers.tick(pollIntervalMs);
    await settle();
    assert.deepEqual(f.warned, ['stop re-read failed', 'stop re-read failed']);
    await f.hub.close();
  } finally {
    mock.timers.reset();
  }
});

void test('a workflow id that is not a turn id is never re-read', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const f = fixture(new Set(['m1']));
    const step = f.hub.register('not-a-turn');
    mock.timers.tick(pollIntervalMs);
    await settle();
    assert.equal(f.queries.length, 0);
    assert.equal(step.signal.aborted, false);
    await f.hub.close();
  } finally {
    mock.timers.reset();
  }
});

void test('close ends the listener and the poll', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const f = fixture(new Set());
    f.hub.register(wf1);
    await f.hub.close();
    mock.timers.tick(pollIntervalMs * 2);
    await settle();
    assert.equal(f.closedCount(), 1);
    assert.equal(f.queries.length, 0);
  } finally {
    mock.timers.reset();
  }
});
