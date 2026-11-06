import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createHealthServer } from './health.ts';
import type { HealthServer, HealthTools } from './health.ts';

const HOST = '127.0.0.1';
const TOKEN = 'worker-tools-token-value';
const ENTRIES = [{ key: 'lookup', implementationVersion: 1 }];

async function freePort(): Promise<number> {
  const s = createServer();
  await new Promise<void>((r) => {
    s.listen(0, HOST, r);
  });
  const { port } = s.address() as { port: number };
  await new Promise<void>((r) => {
    s.close(() => {
      r();
    });
  });
  return port;
}

async function serve(tools?: HealthTools): Promise<{
  server: HealthServer;
  port: number;
}> {
  const port = await freePort();
  const server = createHealthServer({
    host: HOST,
    port,
    probeTimeoutMs: 100,
    isReady: () => true,
    probes: () => [],
    ...(tools === undefined ? {} : { tools }),
  });
  await server.listen();
  return { server, port };
}

async function get(port: number, path: string, authorization?: string) {
  const headers: Record<string, string> =
    authorization === undefined ? {} : { authorization };
  const r = await fetch(`http://${HOST}:${String(port)}${path}`, { headers });
  return { status: r.status, body: await r.text() };
}

void test('V4: GET /tools answers 401 {} unless the header is exactly Bearer <token>', async () => {
  const { server, port } = await serve({
    token: TOKEN,
    entries: () => ENTRIES,
  });
  try {
    const sameLengthWrong = `Bearer ${'x'.repeat(TOKEN.length)}`;
    const otherLength = 'Bearer x';
    const cases = [
      { name: 'no header', header: undefined },
      { name: 'same length, wrong token', header: sameLengthWrong },
      { name: 'other length', header: otherLength },
      { name: 'Basic scheme', header: `Basic ${TOKEN}` },
    ];
    for (const c of cases) {
      const r = await get(port, '/tools', c.header);
      assert.deepEqual(
        { name: c.name, status: r.status, body: r.body },
        { name: c.name, status: 401, body: '{}' },
      );
    }

    const ok = await get(port, '/tools', `Bearer ${TOKEN}`);
    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.body), ENTRIES);
    assert.ok(!ok.body.includes(TOKEN));

    const health = await get(port, '/healthz');
    assert.deepEqual(health, { status: 200, body: '{}' });
  } finally {
    await server.close();
  }
});

void test('V4: a server built without tools answers /tools as an unknown path', async () => {
  const { server, port } = await serve();
  try {
    const r = await get(port, '/tools', `Bearer ${TOKEN}`);
    assert.deepEqual(r, { status: 404, body: '{}' });
  } finally {
    await server.close();
  }
});
