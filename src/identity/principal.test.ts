import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOrgId } from '../db/index.ts';
import { agentPrincipalId, parsePrincipalId } from './principal.ts';
import type { PrincipalId } from './principal.ts';

void test('parsePrincipalId accepts user and agent ids', () => {
  for (const good of ['user:corp~idp|abc', 'agent:org-a~ag1']) {
    const r = parsePrincipalId(good);
    assert.equal(r.ok && r.value, good);
  }
});

void test('parsePrincipalId rejects malformed ids', () => {
  const bad = [
    'user:corp~a:b',
    'user:corp~a#b',
    'user:Corp~a',
    'user:corp~a b',
    'user:corp~',
    'agent:org-a~',
    'agent:org-a~a:b',
    'agent:org a~x',
    'agent:~x',
    'person:corp~a',
    7,
  ];
  for (const raw of bad) {
    const r = parsePrincipalId(raw);
    assert.equal(!r.ok && r.error.code, 'invalid_argument');
  }
});

void test('parsePrincipalId error does not echo the input', () => {
  const r = parsePrincipalId('user:corp~secret@x y');
  assert.equal(r.ok, false);
  assert.equal(r.error.message.includes('secret@x'), false);
});

void test('agentPrincipalId builds the agent shape', () => {
  const org = parseOrgId('org-a');
  assert.ok(org.ok);
  const r = agentPrincipalId(org.value, 'ag1');
  assert.equal(r.ok && r.value, 'agent:org-a~ag1');
  assert.equal(agentPrincipalId(org.value, 'a b').ok, false);
  assert.equal(agentPrincipalId(org.value, '').ok, false);
});

void test('a plain string is not a PrincipalId', () => {
  const takesId = (id: PrincipalId): PrincipalId => id;
  // @ts-expect-error a hand-cast string must not type-check
  assert.equal(takesId('agent:org-a~ag1'), 'agent:org-a~ag1');
});
