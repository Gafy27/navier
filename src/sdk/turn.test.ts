import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

void test('V2: awaitTurn, the SDK runtime and the chat handler name no Temporal type', async () => {
  for (const file of [
    './turn.ts',
    './runtime.ts',
    '../api/routes/chat/handler.ts',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /TemporalHandle/, file);
  }
  const turn = await readFile(new URL('./turn.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(turn, /@temporalio/);
});
