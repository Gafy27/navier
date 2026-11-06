import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DatabaseConfig } from '../config.ts';
import type { createListener } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import type { Logger } from '../index.ts';
import { createStreamHub } from './stream-hub.ts';

type Listen = typeof createListener;

/** A `listen` that counts calls and lets the test emit payloads by hand. */
function fakeListen() {
  let calls = 0;
  let closed = 0;
  let onPayload: ((payload: string) => void) | undefined;
  const listen: Listen = (_config, _log, _channel, callback) => {
    calls += 1;
    onPayload = callback;
    return {
      close: () => {
        closed += 1;
        return Promise.resolve();
      },
    };
  };
  return {
    listen,
    emit: (payload: string) => onPayload?.(payload),
    calls: () => calls,
    closed: () => closed,
  };
}

const deps = { config: {} as DatabaseConfig, log: {} as Logger };
const orgA = 'A' as OrgId;
const orgB = 'B' as OrgId;

void test('V44: a payload wakes exactly the waiters on its org and message', async () => {
  const fake = fakeListen();
  const hub = createStreamHub(fake.listen, deps);
  const first = new AbortController();
  const second = new AbortController();
  const other = new AbortController();
  const nullWaiter = new AbortController();
  const a1 = hub.wait({ org: orgA, messageId: 'm' }, first.signal, 5_000);
  const a2 = hub.wait({ org: orgA, messageId: 'm' }, second.signal, 5_000);
  const b = hub.wait({ org: orgB, messageId: 'm' }, other.signal, 300);
  const none = hub.wait(null, nullWaiter.signal, 300);

  fake.emit('A|m|7');

  assert.equal(await a1, 'woken');
  assert.equal(await a2, 'woken');
  assert.equal(await b, 'tick');
  assert.equal(await none, 'tick');
  await hub.close();
});

void test('V44: an aborted signal ends its wait with tick at once', async () => {
  const hub = createStreamHub(fakeListen().listen, deps);
  const ctrl = new AbortController();
  const pending = hub.wait({ org: orgA, messageId: 'm' }, ctrl.signal, 5_000);
  ctrl.abort();
  assert.equal(await pending, 'tick');
  await hub.close();
});

void test('a signal aborted before the call resolves tick without a timer', async () => {
  const hub = createStreamHub(fakeListen().listen, deps);
  const ctrl = new AbortController();
  ctrl.abort();
  assert.equal(
    await hub.wait({ org: orgA, messageId: 'm' }, ctrl.signal, 5_000),
    'tick',
  );
  await hub.close();
});

void test('a malformed payload is ignored and does not throw', async () => {
  const fake = fakeListen();
  const hub = createStreamHub(fake.listen, deps);
  const ctrl = new AbortController();
  const pending = hub.wait({ org: orgA, messageId: 'm' }, ctrl.signal, 5_000);
  fake.emit('junk');
  fake.emit('A|m|x');
  fake.emit('|m|1');
  fake.emit('A|m|');
  await hub.close();
  assert.equal(await pending, 'tick');
});

void test('one listener serves every wait; close closes it and resolves each waiter', async () => {
  const fake = fakeListen();
  const hub = createStreamHub(fake.listen, deps);
  const ctrl = new AbortController();
  const a = hub.wait({ org: orgA, messageId: 'm' }, ctrl.signal, 5_000);
  const b = hub.wait({ org: orgB, messageId: 'x' }, ctrl.signal, 5_000);
  const n = hub.wait(null, ctrl.signal, 5_000);
  assert.equal(fake.calls(), 1);
  await hub.close();
  assert.equal(await a, 'tick');
  assert.equal(await b, 'tick');
  assert.equal(await n, 'tick');
  assert.equal(fake.closed(), 1);
});
