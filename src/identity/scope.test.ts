import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode } from '../index.ts';
import {
  formatScope,
  parseScope,
  SCOPE_GRAMMAR,
  ScopeResource,
} from './scope.ts';

const validId: Record<ScopeResource, string | undefined> = {
  agent: 'ag1',
  tool: 'web.search',
  fs: '/notes',
  sandbox: undefined,
  model: undefined,
  agent_create: undefined,
  tool_create: undefined,
  org: 'admin',
};

function rejects(raw: unknown): boolean {
  const r = parseScope(raw);
  return !r.ok && r.error.code === ErrorCode.invalid_argument;
}

void test('every grammar row parses with a valid id', () => {
  for (const resource of Object.values(ScopeResource)) {
    const row = SCOPE_GRAMMAR[resource];
    const id = validId[resource];
    for (const action of row.actions) {
      const raw =
        id === undefined
          ? `${resource}:${action}`
          : `${resource}:${action}:${id}`;
      const r = parseScope(raw);
      assert.equal(r.ok && formatScope(r.value), raw);
    }
  }
});

void test('parseScope rejects bad scopes', () => {
  for (const bad of [
    'tool:invoke:*',
    'tool:invoke',
    'sandbox:exec:x',
    'sandbox:exec:',
    'model:admin:x',
    'model:read',
    'model:write',
    'tool:enable',
    'tool:register',
    'agent_create:create:x',
    'agent_create:admin',
    'tool_create:create:x',
    'tool_create:admin',
    'agent:delete:x',
    'db:read:x',
    'tool:invoke:a:b:c',
    'tool:invoke:',
    'agent:write:a:b',
    'constructor:x:y',
    'tool',
    '',
    7,
  ]) {
    assert.equal(rejects(bad), true);
  }
});

void test('parseScope applies the fs path rule', () => {
  assert.equal(parseScope('fs:read:/notes').ok, true);
  assert.equal(parseScope('fs:read:/').ok, true);
  for (const bad of [
    'fs:read:notes',
    'fs:read:/a/../b',
    'fs:read:/a//b',
    'fs:read:/a/',
  ]) {
    assert.equal(rejects(bad), true);
  }
});

void test('formatScope inverts parseScope over generated valid scopes', () => {
  let seed = 1;
  const next = (n: number): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const pick = (alphabet: string, max: number): string => {
    let s = '';
    for (let i = 0, n = 1 + next(max); i < n; i++) {
      s += alphabet.charAt(next(alphabet.length));
    }
    return s;
  };
  const generated = ['fs:write:/a:b', 'fs:read:/', 'sandbox:exec'];
  for (let i = 0; i < 500; i++) {
    const path = Array.from({ length: 1 + next(3) }, () =>
      pick('abc012:_.- #%', 5),
    ).join('/');
    generated.push(`fs:${next(2) === 0 ? 'read' : 'write'}:/${path}`);
    generated.push(`tool:assign:a${pick('abc012_.-', 5)}`);
    generated.push(`agent:admin:${pick('abc012_.-@|', 6)}`);
  }
  for (const raw of generated) {
    const r = parseScope(raw);
    assert.ok(r.ok, raw);
    assert.equal(formatScope(r.value), raw);
  }
});

void test('tool:register round-trips with a dotted key', () => {
  const r = parseScope('tool:register:a.b');
  assert.ok(r.ok);
  assert.equal(formatScope(r.value), 'tool:register:a.b');
});
