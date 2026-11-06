import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createLogger } from '../index.ts';
import { coreMigrations, migrate, parseOrgId } from '../db/index.ts';
import { fillToolLimits, hasToolKey } from './catalog.ts';
import { catalogMigrations } from './migrations.ts';
import { catalogView } from './tables.ts';
import { createTestDatabase } from '../../test/support/stack.ts';
import type { TestDatabase } from '../../test/support/stack.ts';

const snapshot = { maxToolOutputBytes: 16, maxToolAttempts: 17 };

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const org = unwrap(parseOrgId('org-a'));

const entry = {
  org_id: org,
  key: 'lookup',
  name: 'Lookup',
  description: 'd',
  input_schema: {},
  retry_on_interrupt: false,
  tool_attempts: 1,
  max_tool_output_bytes: 1000,
  approval: 'never_ask',
  config_schema: null,
  registered_by: 'user:ns~alice',
};

void test('an omitted cap and an omitted retry count copy the snapshot', () => {
  assert.deepEqual(fillToolLimits({ retryOnInterrupt: true }, snapshot), {
    toolAttempts: 17,
    maxToolOutputBytes: 16,
  });
});

void test('a set cap and a set retry count are kept', () => {
  assert.deepEqual(
    fillToolLimits(
      { retryOnInterrupt: true, toolAttempts: 40, maxToolOutputBytes: 1001 },
      snapshot,
    ),
    { toolAttempts: 40, maxToolOutputBytes: 1001 },
  );
});

void test('without retry an omitted toolAttempts is 1', () => {
  assert.deepEqual(
    fillToolLimits(
      { retryOnInterrupt: false, maxToolOutputBytes: 9 },
      snapshot,
    ),
    { toolAttempts: 1, maxToolOutputBytes: 9 },
  );
});

void describe('hasToolKey', () => {
  let t: TestDatabase;

  before(async () => {
    t = await createTestDatabase();
    assert.equal(
      (
        await migrate(
          t.db,
          [...coreMigrations, ...catalogMigrations],
          createLogger('silent'),
        )
      ).ok,
      true,
    );
  });

  after(async () => {
    await t.close();
  });

  void test('V4: hasToolKey is false with no row and true across versions', async () => {
    assert.equal(await hasToolKey(t.db, org, 'lookup'), false);
    const q = catalogView(t.db);
    await q
      .insertInto('tool_entry')
      .values({ ...entry, implementation_version: 1 })
      .execute();
    assert.equal(await hasToolKey(t.db, org, 'lookup'), true);
    await q
      .insertInto('tool_entry')
      .values({ ...entry, implementation_version: 2, name: 'Lookup v2' })
      .execute();
    assert.equal(await hasToolKey(t.db, org, 'lookup'), true);
  });

  void test('V4: hasToolKey ignores another org', async () => {
    const orgB = unwrap(parseOrgId('org-b'));
    assert.equal(await hasToolKey(t.db, orgB, 'lookup'), false);
  });
});
