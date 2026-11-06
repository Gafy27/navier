import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { test } from 'node:test';
import { Credential } from './credential.ts';

const token = 'eyJhbGciOiJSUzI1NiJ9.payload.signature';

void test('a credential never prints its token', () => {
  const credential = new Credential(token);
  const shown = [
    JSON.stringify({ credential }),
    inspect({ credential }, { depth: 5 }),
    String(credential),
    credential.toString(),
    JSON.stringify(Object.getOwnPropertyNames(credential)),
  ].join('\n');
  assert.equal(shown.includes('payload'), false);
  assert.equal(shown.includes('[REDACTED]'), true);
});

void test('reveal returns the token', () => {
  assert.equal(new Credential(token).reveal(), token);
});
