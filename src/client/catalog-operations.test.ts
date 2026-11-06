import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../index.ts';
import { catalog } from '../api/catalog.ts';
import { defineRoute, Method, WireType } from '../api/adapter/route-types.ts';
import type { RouteContract } from '../api/adapter/route-types.ts';
import {
  inputSchemaOf,
  listCatalogOperations,
  loginUrl,
  WireType as ExportedWireType,
} from './index.ts';

type AnyContract = RouteContract<unknown, unknown, unknown, unknown, unknown>;

const base = {
  tag: 'test',
  summary: 'entry',
  errors: [],
  method: Method.enum.POST,
  public: true as const,
  params: z.strictObject({}),
};

const withAll = defineRoute({
  ...base,
  operationId: 'withAll',
  path: '/things/:id',
  params: z.strictObject({ id: z.string() }),
  query: z.object({ limit: z.number() }),
  body: z.strictObject({ title: z.string() }),
  response: z.object({}),
});

const bodyOnly = defineRoute({
  ...base,
  operationId: 'bodyOnly',
  path: '/body-only',
  body: z.strictObject({ title: z.string() }),
  response: z.object({}),
});

/** Keys a flat `--key` flag namespace would share: body keys that equal a path or query key (PD6). */
function keysOf(schema: z.ZodType | undefined): string[] {
  return schema instanceof z.ZodObject ? Object.keys(schema.shape) : [];
}

function flagCollisions(contract: AnyContract): string[] {
  const taken = new Set([
    ...keysOf(contract.params),
    ...keysOf(contract.query),
  ]);
  return keysOf(contract.body).filter((key) => taken.has(key));
}

void test('V11: listCatalogOperations has one row per catalog key, in the catalog key order', () => {
  const operations = listCatalogOperations();
  assert.deepEqual(
    operations.map((op) => op.operationId),
    Object.keys(catalog),
  );
});

void test('V11: a stream entry is kind stream and every other row is plain', () => {
  const streamKeys = Object.entries<AnyContract>(catalog)
    .filter(([, c]) => c.kind === 'stream')
    .map(([key]) => key);
  const streamRows = listCatalogOperations()
    .filter((op) => op.kind === 'stream')
    .map((op) => op.operationId);
  assert.deepEqual(streamRows, streamKeys);
  assert.ok(streamKeys.includes('message'));
});

void test('V10: a route with params, query, and body keeps the body under `body`', () => {
  const keys = Object.keys(inputSchemaOf(withAll).shape).sort();
  assert.deepEqual(keys, ['body', 'id', 'limit']);
  assert.equal(
    inputSchemaOf(withAll).safeParse({
      id: 'a',
      limit: 1,
      body: { title: 't' },
    }).success,
    true,
  );
  assert.equal(
    inputSchemaOf(withAll).safeParse({ id: 'a', limit: 1, title: 't' }).success,
    false,
    'a body key at the top level is refused',
  );
});

void test('V10: a route with a body only has exactly the `body` key', () => {
  assert.deepEqual(Object.keys(inputSchemaOf(bodyOnly).shape), ['body']);
});

void test('V10: a route with no body has no `body` key', () => {
  assert.equal('body' in inputSchemaOf(catalog.me).shape, false);
});

void test('V10: the stream route carries lastEventId as a query key', () => {
  const keys = Object.keys(inputSchemaOf(catalog.message).shape).sort();
  assert.deepEqual(keys, ['conv', 'lastEventId', 'msg', 'org']);
  assert.equal(
    inputSchemaOf(catalog.message).safeParse({
      org: 'o',
      conv: 'c',
      msg: 'm',
      lastEventId: '3',
    }).success,
    true,
  );
});

void test('V11: no catalog route has a body key equal to a path or query key', () => {
  for (const contract of Object.values<AnyContract>(catalog)) {
    assert.deepEqual(flagCollisions(contract), [], contract.operationId);
  }
});

void test('V11: a mutated contract with a body key equal to a path key is a collision', () => {
  const clash = defineRoute({
    ...base,
    operationId: 'clash',
    path: '/clash/:id',
    params: z.strictObject({ id: z.string() }),
    body: z.strictObject({ id: z.string() }),
    response: z.object({}),
  });
  assert.deepEqual(flagCollisions(clash), ['id']);
});

void test('D6: WireType is exported from the client entry', () => {
  assert.equal(ExportedWireType, WireType);
  assert.ok(WireType.options.includes(WireType.enum.unauthenticated));
});

void test('D1: loginUrl joins the base, the /api/v1 prefix, and the login path once', () => {
  const challenge = 'a'.repeat(43);
  const url = new URL(
    loginUrl('http://127.0.0.1:8080', {
      return: 'http://127.0.0.1:43123/callback',
      handoffChallenge: challenge,
    }),
  );
  assert.equal(
    url.origin + url.pathname,
    'http://127.0.0.1:8080/api/v1/auth/login',
  );
  assert.equal(
    url.searchParams.get('return'),
    'http://127.0.0.1:43123/callback',
  );
  assert.equal(url.searchParams.get('handoff_challenge'), challenge);
});
