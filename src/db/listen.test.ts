import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabaseConfig } from '../config.ts';
import type { Logger } from '../index.ts';
import type { Tx } from './db.ts';
import { createListener, notify } from './listen.ts';

void test('V2: the channel is the literal stream_delta (typecheck)', () => {
  // Never called; `npm run typecheck` fails if either channel widens.
  const probe = (tx: Tx, config: DatabaseConfig, log: Logger) => {
    // @ts-expect-error another channel is refused
    void notify(tx, 'other', 'A|m|3');
    // @ts-expect-error another channel is refused
    createListener(config, log, 'other', () => undefined);
  };
  assert.equal(typeof probe, 'function');
});
