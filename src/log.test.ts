import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLogger, REDACTED } from './log.ts';

function capture(): { lines: string[]; log: ReturnType<typeof createLogger> } {
  const lines: string[] = [];
  const log = createLogger('info', {
    write: (line: string) => {
      lines.push(line);
    },
  });
  return { lines, log };
}

function nested(depth: number, leaf: unknown): unknown {
  let node = leaf;
  for (let i = 0; i < depth; i++) node = { child: node };
  return node;
}

void test('authorization and cookie headers are redacted, accept is not', () => {
  const marker = randomUUID();
  const { lines, log } = capture();
  log.info({
    req: {
      headers: {
        authorization: marker,
        Authorization: marker,
        cookie: marker,
        accept: 'text/html',
      },
    },
  });
  const out = lines.join('');
  assert.equal(out.includes(marker), false);
  assert.match(out, /"accept":"text\/html"/);
});

void test('secret-named keys are redacted at any depth and shape', () => {
  const marker = randomUUID();
  const conn = `postgres://u:${marker}@h/db`;
  const { lines, log } = capture();
  log.info({
    a: { b: { c: { refresh_token: marker } } },
    list: [{ apiKey: marker }],
    claims: { sub: marker },
    'x-api-token': marker,
    clientSecret: marker,
    databaseUrl: conn,
    DATABASE_URL: conn,
    dsn: conn,
    err: new Error('boom', { cause: { password: marker } }),
  });
  assert.equal(lines.join('').includes(marker), false);
  assert.match(lines.join(''), new RegExp(REDACTED.replace(/[[\]]/g, '\\$&')));
});

void test('an Error with a secret property is redacted', () => {
  const marker = randomUUID();
  const { lines, log } = capture();
  log.info({ failure: Object.assign(new Error('x'), { accessToken: marker }) });
  assert.equal(lines.join('').includes(marker), false);
});

void test('plain fields print unchanged', () => {
  const { lines, log } = capture();
  log.info({ user: 'ada', count: 3, url: 'http://example.test/x' });
  const entry = JSON.parse(lines.join('')) as Record<string, unknown>;
  assert.equal(entry['user'], 'ada');
  assert.equal(entry['count'], 3);
  assert.equal(entry['url'], 'http://example.test/x');
});

void test('a cycle does not throw and does not leak', () => {
  const marker = randomUUID();
  const cyclic: Record<string, unknown> = { note: 'x', password: marker };
  cyclic['self'] = cyclic;
  const { lines, log } = capture();
  assert.doesNotThrow(() => {
    log.info({ cyclic });
  });
  assert.equal(lines.join('').includes(marker), false);
});

void test('a 40-level object fails closed', () => {
  const marker = randomUUID();
  const { lines, log } = capture();
  assert.doesNotThrow(() => {
    log.info({ deep: nested(40, { value: marker }) });
  });
  assert.equal(lines.join('').includes(marker), false);
});
