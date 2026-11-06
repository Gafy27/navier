import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../index.ts';
import { defineRoute, Method, WireType } from '../api/adapter/route-types.ts';
import { catalog } from '../api/catalog.ts';
import { clientCatalogKeys, createClient } from './index.ts';
import { StreamFailure } from './stream.ts';

const BASE = 'http://api.test';

void test('P15: blocked-action catalog entries have client methods', () => {
  const client = createClient({
    baseUrl: BASE,
    credential: () => undefined,
    fetch: () => Promise.resolve(Response.json({ items: [] })),
  });
  for (const id of [
    'listBlockedActions',
    'approveBlockedAction',
    'denyBlockedAction',
  ] as const) {
    assert.ok(id in catalog, id);
    assert.equal(typeof client[id], 'function', id);
  }
});

void test('PD7, V26 (a): clientCatalogKeys keeps a json key and drops a stream key', () => {
  const base = {
    tag: 'test',
    summary: 'entry',
    errors: [],
    method: Method.enum.GET,
    public: true as const,
    params: z.strictObject({}),
  };
  const plain = defineRoute({
    ...base,
    operationId: 'plain',
    path: '/plain',
    response: z.object({}),
  });
  const frames = defineRoute({
    ...base,
    operationId: 'frames',
    path: '/frames',
    kind: 'stream',
    event: z.object({ id: z.string().nullable() }),
  });
  assert.deepEqual(Object.keys(clientCatalogKeys({ frames, plain })), [
    'plain',
  ]);
});

function clientWith(
  respond: (req: Request) => Response,
  credential: string | undefined,
): { client: ReturnType<typeof createClient>; seen: Request[] } {
  const seen: Request[] = [];
  const client = createClient({
    baseUrl: BASE,
    credential: () => credential,
    fetch: (req) => {
      seen.push(req);
      return Promise.resolve(respond(req));
    },
  });
  return { client, seen };
}

void test('PD3: the method calls the contract path with a bearer and parses the response', async () => {
  const { client, seen } = clientWith(
    () => Response.json({ openapi: '3.1.0' }),
    'tok',
  );
  const res = await client.getOpenApi({});
  assert.deepEqual(res, { ok: true, value: { openapi: '3.1.0' } });
  const [req] = seen;
  assert.ok(req);
  assert.equal(req.url, `${BASE}/api/v1/openapi.json`);
  assert.equal(req.method, 'GET');
  assert.equal(req.headers.get('authorization'), 'Bearer tok');
});

void test('PD3: no credential sends no authorization header', async () => {
  const { client, seen } = clientWith(() => Response.json({}), undefined);
  await client.getOpenApi({});
  const [req] = seen;
  assert.ok(req);
  assert.equal(req.headers.has('authorization'), false);
});

void test('PD3: an error envelope becomes a typed failure', async () => {
  const { client } = clientWith(
    () =>
      Response.json(
        { error: { type: WireType.enum.unauthenticated, message: 'm' } },
        { status: 401 },
      ),
    undefined,
  );
  assert.deepEqual(await client.getOpenApi({}), {
    ok: false,
    status: 401,
    error: { type: WireType.enum.unauthenticated, message: 'm' },
  });
});

const MESSAGE_PATH = `${BASE}/api/v1/orgs/o/conversations/c/messages/m/events`;

/** One message frame the way the server writes it (PD6, D5). */
const deltaBlock = (id: string): string =>
  `id: ${id}\ndata: ${JSON.stringify({ id, kind: 'delta', delta: 'text', traceId: 't', text: 'x' })}\n\n`;

function sseResponse(...blocks: string[]): Response {
  return new Response(blocks.join(''), {
    headers: { 'content-type': 'text/event-stream' },
  });
}

void test('PD10, PD6: client.stream.message sends the cursor as Last-Event-ID, never in the query, and reads the credential on each connect', async () => {
  const tokens = ['t1', 't2'];
  const seen: Request[] = [];
  const client = createClient({
    baseUrl: BASE,
    credential: () => tokens.shift(),
    fetch: (req) => {
      seen.push(req);
      return Promise.resolve(
        seen.length === 1
          ? sseResponse(deltaBlock('3'))
          : sseResponse(
              `id: 3.end\ndata: ${JSON.stringify({ id: '3.end', kind: 'end-of-stream' })}\n\n`,
            ),
      );
    },
  });
  const ids: (string | null)[] = [];
  for await (const frame of client.stream.message({
    org: 'o',
    conv: 'c',
    msg: 'm',
    lastEventId: '2',
  })) {
    ids.push(frame.id);
  }
  assert.deepEqual(ids, ['3', '3.end']);
  const [first, second] = seen;
  assert.ok(first && second);
  assert.equal(first.url, MESSAGE_PATH);
  assert.equal(first.headers.get('last-event-id'), '2');
  assert.equal(first.headers.get('authorization'), 'Bearer t1');
  assert.equal(second.headers.get('last-event-id'), '3');
  assert.equal(second.headers.get('authorization'), 'Bearer t2');
});

void test('PD6, V39: a refused stream connect ends the iterable with the typed failure', async () => {
  const client = createClient({
    baseUrl: BASE,
    credential: () => 'tok',
    fetch: () =>
      Promise.resolve(
        Response.json(
          { error: { type: WireType.enum.unauthenticated, message: 'm' } },
          { status: 401 },
        ),
      ),
  });
  await assert.rejects(
    (async () => {
      for await (const frame of client.stream.message({
        org: 'o',
        conv: 'c',
        msg: 'm',
      })) {
        assert.fail(`unexpected frame ${frame.kind}`);
      }
    })(),
    (err: unknown) =>
      err instanceof StreamFailure &&
      err.status === 401 &&
      err.type === WireType.enum.unauthenticated,
  );
});

void test('PD3: a body that is not the envelope is internal', async () => {
  const { client } = clientWith(
    () => new Response('boom', { status: 502 }),
    'tok',
  );
  assert.deepEqual(await client.getOpenApi({}), {
    ok: false,
    status: 502,
    error: { type: WireType.enum.internal, message: 'unexpected response' },
  });
});
