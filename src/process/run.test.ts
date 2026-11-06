import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createLogger, ok, appError, err, ErrorCode } from '../index.ts';
import { HealthConfigSchema } from '../config.ts';
import { loadConfig } from '../index.ts';
import { runProcess } from './run.ts';
import type { Resource } from './run.ts';

async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((r) => {
    s.listen(0, '127.0.0.1', r);
  });
  const { port } = s.address() as { port: number };
  await new Promise<void>((r) => {
    s.close(() => {
      r();
    });
  });
  return port;
}

function harness(overrides: { budget?: number; probeMs?: number } = {}) {
  const lines: string[] = [];
  const log = createLogger('info', {
    write: (l: string) => {
      lines.push(l);
    },
  });
  const signals = new EventEmitter();
  const order: string[] = [];
  const base = {
    kind: 'api' as const,
    log,
    signals: {
      on: (e: 'SIGTERM' | 'SIGINT', l: () => void) => signals.on(e, l),
      off: (e: 'SIGTERM' | 'SIGINT', l: () => void) => signals.off(e, l),
    },
  };
  return { lines, signals, order, base, ...overrides };
}

async function config(budget = 1000, probeMs = 100) {
  return {
    SHUTDOWN_TIMEOUT_MS: budget,
    HEALTH_HOST: '127.0.0.1',
    HEALTH_PORT: await freePort(),
    PROBE_TIMEOUT_MS: probeMs,
  };
}

const sleep = (ms: number) =>
  new Promise<void>((r) => {
    setTimeout(r, ms);
  });

function res(
  order: string[],
  name: string,
  extra: Partial<Resource> = {},
): Resource {
  return {
    name,
    close: () => {
      order.push(name);
      return Promise.resolve();
    },
    ...extra,
  };
}

async function status(
  c: { HEALTH_PORT: number },
  path: string,
  method = 'GET',
) {
  const r = await fetch(`http://127.0.0.1:${String(c.HEALTH_PORT)}${path}`, {
    method,
  });
  const text = await r.text();
  return { status: r.status, body: text };
}

void test('V1: a failed boot closes what opened, in reverse order, and exits 1', async () => {
  const h = harness();
  const code = await runProcess({
    ...h.base,
    config: await config(),
    open: (track) => {
      track(res(h.order, 'A'));
      track(res(h.order, 'B'));
      return Promise.resolve(err(appError(ErrorCode.unavailable, 'x')));
    },
  });
  assert.equal(code, 1);
  assert.deepEqual(h.order, ['B', 'A']);

  const h2 = harness();
  const code2 = await runProcess({
    ...h2.base,
    config: await config(),
    open: (track) => {
      track(res(h2.order, 'A'));
      throw new Error('boom');
    },
  });
  assert.equal(code2, 1);
  assert.deepEqual(h2.order, ['A']);
});

void test('V2: readiness is off before the first close; close order is reverse; exit 0', async () => {
  const h = harness();
  const c = await config();
  let statusAtFirstClose = 0;
  const run = runProcess({
    ...h.base,
    config: c,
    open: (track) => {
      track(res(h.order, 'A'));
      track(res(h.order, 'B'));
      track({
        name: 'C',
        close: async () => {
          statusAtFirstClose = (await status(c, '/readyz')).status;
          h.order.push('C');
        },
      });
      return Promise.resolve(ok(undefined));
    },
  });
  await sleep(100);
  assert.equal((await status(c, '/readyz')).status, 200);
  h.signals.emit('SIGTERM');
  assert.equal(await run, 0);
  assert.equal(statusAtFirstClose, 503);
  assert.deepEqual(h.order, ['C', 'B', 'A']);
  await assert.rejects(status(c, '/healthz'));
});

void test('V3: the budget covers the whole shutdown and names the stuck resource', async () => {
  const h = harness();
  const c = await config(200);
  const run = runProcess({
    ...h.base,
    config: c,
    open: (track) => {
      track(res(h.order, 'A'));
      track({ name: 'B', close: () => new Promise<void>(() => undefined) });
      return Promise.resolve(ok(undefined));
    },
  });
  await sleep(50);
  const t0 = Date.now();
  h.signals.emit('SIGTERM');
  assert.equal(await run, 1);
  assert.ok(Date.now() - t0 < 300);
  assert.ok(h.lines.some((l) => l.includes('"resource":"B"')));
});

void test('V4: a second signal exits 1 at once', async () => {
  const h = harness();
  const c = await config(10000);
  const run = runProcess({
    ...h.base,
    config: c,
    open: (track) => {
      track({ name: 'B', close: () => sleep(1000) });
      return Promise.resolve(ok(undefined));
    },
  });
  await sleep(50);
  h.signals.emit('SIGTERM');
  await sleep(50);
  const t0 = Date.now();
  h.signals.emit('SIGINT');
  assert.equal(await run, 1);
  assert.ok(Date.now() - t0 < 100);
});

void test('V5: a throwing close is logged, shutdown continues, exit 1', async () => {
  const h = harness();
  const c = await config();
  const run = runProcess({
    ...h.base,
    config: c,
    open: (track) => {
      track(res(h.order, 'A'));
      track({ name: 'B', close: () => Promise.reject(new Error('nope')) });
      track(res(h.order, 'C'));
      return Promise.resolve(ok(undefined));
    },
  });
  await sleep(50);
  h.signals.emit('SIGTERM');
  assert.equal(await run, 1);
  assert.deepEqual(h.order, ['C', 'A']);
  assert.ok(h.lines.some((l) => l.includes('"resource":"B"')));
  await assert.rejects(status(c, '/healthz'));
});

void test('V6: readiness answers, bodies hold booleans only', async () => {
  const h = harness();
  const c = await config(1000, 100);
  let gate!: () => void;
  const opening = new Promise<void>((r) => {
    gate = r;
  });
  let secondAnswer: 'yes' | 'no' | 'never' = 'yes';
  const run = runProcess({
    ...h.base,
    config: c,
    open: async (track) => {
      await opening;
      track({
        ...res(h.order, 'A'),
        probe: { name: 'one', check: () => Promise.resolve(true) },
      });
      track({
        ...res(h.order, 'B'),
        probe: {
          name: 'two',
          check: () =>
            secondAnswer === 'never'
              ? new Promise<boolean>(() => undefined)
              : Promise.resolve(secondAnswer === 'yes'),
        },
      });
      return ok(undefined);
    },
  });
  await sleep(50);
  assert.equal((await status(c, '/healthz')).status, 200);
  assert.equal((await status(c, '/readyz')).status, 503);
  gate();
  await sleep(50);
  const yes = await status(c, '/readyz');
  assert.equal(yes.status, 200);
  assert.deepEqual(JSON.parse(yes.body), {
    ready: true,
    probes: { one: true, two: true },
  });
  secondAnswer = 'no';
  const no = await status(c, '/readyz');
  assert.equal(no.status, 503);
  assert.deepEqual(JSON.parse(no.body), {
    ready: false,
    probes: { one: true, two: false },
  });
  secondAnswer = 'never';
  const t0 = Date.now();
  assert.equal((await status(c, '/readyz')).status, 503);
  assert.ok(Date.now() - t0 < 300);
  assert.equal((await status(c, '/readyz', 'POST')).status, 405);
  assert.equal((await status(c, '/nope')).status, 404);
  h.signals.emit('SIGTERM');
  assert.equal(await run, 0);
});

void test('V4: ProcessSpec.tools reaches the health server; GET /tools answers the bearer', async () => {
  const h = harness();
  const c = await config(1000, 100);
  const run = runProcess({
    ...h.base,
    config: c,
    tools: { token: 'tok', entries: () => [{ key: 'lookup' }] },
    open: () => Promise.resolve(ok(undefined)),
  });
  await sleep(50);
  const denied = await fetch(`http://127.0.0.1:${String(c.HEALTH_PORT)}/tools`);
  assert.equal(denied.status, 401);
  const served = await fetch(
    `http://127.0.0.1:${String(c.HEALTH_PORT)}/tools`,
    { headers: { authorization: 'Bearer tok' } },
  );
  assert.equal(served.status, 200);
  assert.deepEqual(await served.json(), [{ key: 'lookup' }]);
  h.signals.emit('SIGTERM');
  assert.equal(await run, 0);
});

void test('V15: PROBE_TIMEOUT_MS falls back to 2000 and the bounds hold', () => {
  const base = { HEALTH_HOST: 'h', HEALTH_PORT: '8080' };
  const r = loadConfig(HealthConfigSchema, base);
  assert.equal(r.ok && r.value.PROBE_TIMEOUT_MS, 2000);
  assert.equal(
    loadConfig(HealthConfigSchema, { ...base, PROBE_TIMEOUT_MS: '1' }).ok,
    true,
  );
  assert.equal(
    loadConfig(HealthConfigSchema, { ...base, PROBE_TIMEOUT_MS: '0' }).ok,
    false,
  );
  for (const [port, okay] of [
    ['0', false],
    ['65536', false],
    ['65535', true],
  ] as const) {
    assert.equal(
      loadConfig(HealthConfigSchema, { ...base, HEALTH_PORT: port }).ok,
      okay,
    );
  }
});
