import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { sealWithKeyring, unsealWithKeyring } from './keyring.ts';
import type { Sealed } from './seal.ts';

const dir = mkdtempSync(join(tmpdir(), 'keyring-'));
const file = join(dir, 'keys.json');
const k1 = randomBytes(32);
const k2 = randomBytes(32);
const aad = ['api_session', 'h1'] as const;
// The key file reader reads the process environment.
// eslint-disable-next-line no-restricted-syntax
const env = process.env;
const previous = env['SECRETS_KEYS_FILE'];

function writeKeys(current: string, keys: Record<string, Buffer>): void {
  const encoded = Object.fromEntries(
    Object.entries(keys).map(([id, key]) => [id, key.toString('base64')]),
  );
  writeFileSync(file, JSON.stringify({ current, keys: encoded }));
}

function sealT(): Sealed {
  const sealed = sealWithKeyring('t', aad);
  if (!sealed.ok) throw new Error(sealed.error.message);
  return sealed.value;
}

function failureMessage(sealed: Sealed, at: readonly string[]): string {
  const opened = unsealWithKeyring(sealed, at);
  if (opened.ok) throw new Error('unexpected success');
  return opened.error.message;
}

env['SECRETS_KEYS_FILE'] = file;
after(() => {
  if (previous === undefined) delete env['SECRETS_KEYS_FILE'];
  else env['SECRETS_KEYS_FILE'] = previous;
  rmSync(dir, { recursive: true, force: true });
});

void test('a value sealed with the keyring opens only with its AAD', () => {
  writeKeys('k1', { k1, k2 });
  const sealed = sealT();
  assert.equal(sealed.keyId, 'k1');
  assert.deepEqual(unsealWithKeyring(sealed, aad), { ok: true, value: 't' });
  const messages = [
    failureMessage(sealed, ['api_session', 'h2']),
    failureMessage(sealed, ['api_login_state', 'h1']),
  ];
  for (const message of messages) {
    assert.equal(message.includes(k1.toString('base64')), false);
    assert.equal(message.includes('k1'), false);
  }
});

void test('a rotated file opens old values while their key stays', () => {
  writeKeys('k1', { k1, k2 });
  const sealed = sealT();
  writeKeys('k2', { k1, k2 });
  assert.deepEqual(unsealWithKeyring(sealed, aad), { ok: true, value: 't' });
  assert.equal(sealT().keyId, 'k2');
  writeKeys('k2', { k2 });
  const message = failureMessage(sealed, aad);
  assert.equal(message.includes(k1.toString('base64')), false);
  assert.equal(message.includes('k1'), false);
});

void test('an unset SECRETS_KEYS_FILE fails naming the variable', () => {
  delete env['SECRETS_KEYS_FILE'];
  try {
    const sealed = sealWithKeyring('t', aad);
    if (sealed.ok) throw new Error('unexpected success');
    assert.match(sealed.error.message, /SECRETS_KEYS_FILE/);
  } finally {
    env['SECRETS_KEYS_FILE'] = file;
  }
});
