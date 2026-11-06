import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMigrateCli } from './migrate.ts';

// No database is reached in these cases: each returns before it connects.
const unreachable = { DATABASE_URL: 'postgresql://127.0.0.1:1/none' };

void test('an unknown argument is a usage error and never connects', async () => {
  assert.equal(await runMigrateCli(['--bogus'], unreachable), 2);
  assert.equal(await runMigrateCli(['--check', 'extra'], unreachable), 2);
});

void test('--check with no DATABASE_URL is an error, exit 2', async () => {
  assert.equal(await runMigrateCli(['--check'], {}), 2);
});

void test('no args with no DATABASE_URL is an error, exit 1 as before', async () => {
  assert.equal(await runMigrateCli([], {}), 1);
});
