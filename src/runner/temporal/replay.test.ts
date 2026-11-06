import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { replayHistories } from './index.ts';

const fixture = (path: string): string =>
  fileURLToPath(new URL(`../../../test/${path}`, import.meta.url));

void test('V3: the stored noop history replays against the noop workflow', async () => {
  const r = await replayHistories(
    fixture('fixtures/workflows/noop.ts'),
    fixture('histories/noop'),
  );
  assert.deepEqual(r, { ok: true, value: 1 });
});

void test('V3: a workflow edited to add a timer fails replay', async () => {
  const r = await replayHistories(
    fixture('fixtures/workflows/noop-edited.ts'),
    fixture('histories/noop'),
  );
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'internal');
});

void test('V3: an empty folder fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'histories-'));
  const r = await replayHistories(fixture('fixtures/workflows/noop.ts'), dir);
  assert.equal(r.ok, false);
});
