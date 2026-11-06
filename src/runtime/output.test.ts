import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { toOutput } from './output.ts';

function recorder() {
  const stored: Uint8Array[] = [];
  const id = randomUUID();
  return {
    id,
    stored,
    store: (bytes: Uint8Array) => {
      stored.push(bytes);
      return Promise.resolve(id);
    },
  };
}

const bytesOf = (text: string) => Buffer.byteLength(text, 'utf8');
const QUOTE_BYTES = bytesOf('""');
const CAP = 256;
/** An ASCII string whose JSON encoding is `size` bytes. */
const stringOf = (size: number) => 'a'.repeat(size - QUOTE_BYTES);

function markerFor(json: string, id: string): string {
  return `[truncated: ${String(bytesOf(json))} bytes; object ${id}]`;
}

void test('V6: exactly the cap is not truncated; one byte over is cut with a marker', async () => {
  const exact = recorder();
  const at = await toOutput(stringOf(CAP), CAP, exact.store);
  assert.ok(at.ok);
  assert.equal(at.value.truncated, false);
  assert.equal(at.value.objectId, null);
  assert.equal(exact.stored.length, 0);

  const over = recorder();
  const payload = stringOf(CAP + 1);
  const full = JSON.stringify(payload);
  const cut = await toOutput(payload, CAP, over.store);
  assert.ok(cut.ok);
  assert.equal(cut.value.truncated, true);
  assert.equal(cut.value.objectId, over.id);
  assert.ok(bytesOf(cut.value.modelText) <= CAP);
  assert.ok(cut.value.modelText.endsWith(markerFor(full, over.id)));
  assert.equal(Buffer.from(over.stored[0] ?? []).toString('utf8'), full);
});

void test('V6: the cut never splits a code point', async () => {
  const r = recorder();
  const body = 'é'.repeat(130);
  const full = JSON.stringify(body);
  const out = await toOutput(body, CAP, r.store);
  assert.ok(out.ok);
  const marker = markerFor(full, r.id);
  const prefix = out.value.modelText.slice(0, -marker.length);
  assert.ok(bytesOf(full) > CAP);
  assert.ok(out.value.modelText.endsWith(marker));
  assert.ok(!prefix.includes('�'));
  assert.ok(bytesOf(out.value.modelText) <= CAP);
});

void test('V6: a cap that cannot hold the marker stores the marker alone', async () => {
  const r = recorder();
  const cap = 16;
  const payload = stringOf(cap + 1);
  const out = await toOutput(payload, cap, r.store);
  assert.ok(out.ok);
  assert.equal(out.value.truncated, true);
  assert.equal(out.value.modelText, markerFor(JSON.stringify(payload), r.id));
  assert.ok(bytesOf(out.value.modelText) > cap);
});

void test('V7: a result that is not plain JSON is refused', async () => {
  const r = recorder();
  const cyclic: Record<string, unknown> = {};
  cyclic['self'] = cyclic;
  for (const bad of [
    1n,
    () => 1,
    undefined,
    NaN,
    new Date(0),
    new Map(),
    { a: undefined },
    cyclic,
  ]) {
    const out = await toOutput(bad, CAP, r.store);
    assert.equal(!out.ok && out.error.code, 'invalid_argument');
  }
  assert.equal(r.stored.length, 0);
  const good = await toOutput({ ok: true }, CAP, r.store);
  assert.ok(good.ok);
  assert.equal(good.value.modelText, '{"ok":true}');
});
