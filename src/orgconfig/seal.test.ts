import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { seal, sealWithAad, unseal, unsealWithAad } from './seal.ts';
import type { Sealed } from './seal.ts';

const key = 'K-test-1';
const place = { org: 'o1', provider: 'p', seq: 1 };
const k1 = randomBytes(32);
const sealOnce = () => seal(key, place, 'k1', k1);

function failure(
  sealed: Sealed,
  at = place,
  keys: Record<string, Buffer> = { k1 },
): string {
  const result = unseal(sealed, at, keys);
  if (result.ok) throw new Error('unexpected success');
  return result.error.message;
}

void test('unseal returns the key that was sealed', () => {
  assert.deepEqual(unseal(sealOnce(), place, { k1 }), {
    ok: true,
    value: key,
  });
});

void test('a copied row, a flipped byte, and a missing key fail alike', () => {
  const sealed = sealOnce();
  const flipped = (field: 'ciphertext' | 'wrappedKey'): Sealed => {
    const copy = Buffer.from(sealed[field]);
    copy.writeUInt8(copy.readUInt8(0) ^ 1, 0);
    return { ...sealed, [field]: copy };
  };
  const messages = [
    failure(sealed, { ...place, org: 'o2' }),
    failure(sealed, { ...place, provider: 'q' }),
    failure(sealed, { ...place, seq: 2 }),
    failure(flipped('ciphertext')),
    failure(flipped('wrappedKey')),
    failure(sealed, place, {}),
  ];
  assert.equal(new Set(messages).size, 1);
  for (const word of ['ciphertext', 'wrapped_key', 'nonce', 'key_id']) {
    assert.equal(messages.join().includes(word), false);
  }
});

void test('two seals of one key differ in both nonces', () => {
  const a = sealOnce();
  const b = sealOnce();
  assert.notDeepEqual(a.dataNonce, b.dataNonce);
  assert.notDeepEqual(a.wrapNonce, b.wrapNonce);
});

void test('a sealed key opens after a new current key id appears', () => {
  const rotated = { k1, k2: randomBytes(32) };
  assert.deepEqual(unseal(sealOnce(), place, rotated), {
    ok: true,
    value: key,
  });
});

void test('seal and sealWithAad share the AAD bytes of the place', () => {
  const sealed = sealOnce();
  const aad = (seq: number) => Buffer.from(JSON.stringify(['o1', 'p', seq]));
  assert.deepEqual(unsealWithAad(sealed, aad(1), k1), { ok: true, value: key });
  assert.equal(unsealWithAad(sealed, aad(2), k1).ok, false);
  const viaAad = sealWithAad(key, aad(1), 'k1', k1);
  assert.deepEqual(unseal(viaAad, place, { k1 }), { ok: true, value: key });
});
