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
import { parseOrgId } from '../db/index.ts';
import type { Tx } from '../db/index.ts';
import { turnWorkflowId } from '../runtime/index.ts';
import { ownerOf } from './owner.ts';
import type { TurnRef } from './types.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const ref: TurnRef = {
  org: parsed.value,
  threadId: 't1',
  agentMessageId: 'm1',
};
const workflowId = turnWorkflowId(ref.org, ref.threadId, ref.agentMessageId);

const dialectBase = {
  createAdapter: () => new PostgresAdapter(),
  createIntrospector: (k: Kysely<unknown>) => new PostgresIntrospector(k),
  createQueryCompiler: () => new PostgresQueryCompiler(),
};

function txAnswering(rows: readonly object[], seen: CompiledQuery[] = []): Tx {
  class Driver extends DummyDriver {
    override acquireConnection(): Promise<DatabaseConnection> {
      return Promise.resolve({
        executeQuery: (query: CompiledQuery) => {
          seen.push(query);
          return Promise.resolve({ rows: [...rows] });
        },
        streamQuery: () => {
          throw new Error('stream');
        },
      } as unknown as DatabaseConnection);
    }
  }
  return new Kysely({
    dialect: { ...dialectBase, createDriver: () => new Driver() },
  }) as unknown as Tx;
}

void test('V3: owner is dbos when workflow_status has a row, else temporal', async () => {
  const seen: CompiledQuery[] = [];
  assert.equal(await ownerOf(txAnswering([{ n: 1 }], seen), ref), 'dbos');
  assert.equal(seen.length, 1);
  assert.match(seen[0]?.sql ?? '', /from dbos\.workflow_status/);
  assert.deepEqual(seen[0]?.parameters, [workflowId]);
  assert.equal(await ownerOf(txAnswering([]), ref), 'temporal');
});

void test('PD2: every lookup reads again, nothing is cached', async () => {
  const seen: CompiledQuery[] = [];
  const tx = txAnswering([], seen);
  await ownerOf(tx, ref);
  await ownerOf(tx, ref);
  assert.equal(seen.length, 2);
});
