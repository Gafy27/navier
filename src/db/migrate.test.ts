import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coreMigrations } from './migrate.ts';

void test('every core migration name is phase_sequence_topic and sorted', () => {
  const names = coreMigrations.map((m) => m.name);
  for (const name of names) assert.match(name, /^\d{2}_\d{4}_[a-z][a-z0-9_]*$/);
  assert.deepEqual(names, [...names].sort());
  assert.equal(new Set(names).size, names.length);
});
