import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDENTITY_AUDIT } from './audit-kinds.ts';
import { identityMigrations } from './migrations.ts';

void test('identity migrations are in name order with the 02 prefix', () => {
  const names = identityMigrations.map((m) => m.name);
  assert.deepEqual(names, [...names].sort());
  for (const name of names) assert.match(name, /^02_\d{4}_[a-z_]+$/);
});

void test('audit kinds fit the unit.event shape', () => {
  for (const kind of Object.values(IDENTITY_AUDIT)) {
    assert.match(kind, /^identity[.][a-z][a-z_]*$/);
  }
});
