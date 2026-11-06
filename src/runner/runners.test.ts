import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { Tx } from '../db/index.ts';
import { createRunners } from './runners.ts';
import type { TurnRef, TurnRunner } from './types.ts';

const parsed = parseOrgId('org-a');
assert.ok(parsed.ok);
const org = parsed.value;
const ref: TurnRef = { org, threadId: 't1', agentMessageId: 'm1' };
const named = (name: TurnRunner['name']) => ({ name }) as TurnRunner;

/** A tx that fails the test on any use: Temporal-only never reads `dbos`. */
const untouchedTx = new Proxy(
  {},
  {
    get: () => {
      throw new Error('tx used');
    },
  },
) as unknown as Tx;

void test('Temporal only: forStart and ownerOf answer Temporal, no query', async () => {
  const temporal = named('temporal');
  const runners = createRunners({ temporal });
  assert.deepEqual(runners.forStart(org), { ok: true, value: temporal });
  assert.deepEqual(await runners.ownerOf(untouchedTx, ref), {
    ok: true,
    value: temporal,
  });
});

void test('a runner that is not configured is unavailable', async () => {
  const runners = createRunners({
    temporal: named('temporal'),
    startOn: () => 'dbos',
  });
  const start = runners.forStart(org);
  assert.ok(!start.ok);
  assert.equal(start.error.code, ErrorCode.unavailable);
  assert.ok(!(await createRunners({}).ownerOf(untouchedTx, ref)).ok);
});
