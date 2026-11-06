import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiMigrations } from './migrations.ts';

void test('api migrations are in name order with the 13 prefix', () => {
  const names = apiMigrations.map((m) => m.name);
  assert.deepEqual(names, [...names].sort());
  for (const name of names) assert.match(name, /^13_\d{4}_[a-z_]+$/);
});
