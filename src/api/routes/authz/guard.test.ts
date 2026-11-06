import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode } from '../../../index.ts';
import { parseOrgId } from '../../../db/index.ts';
import { requireSameOrg } from './guard.ts';

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const orgA = unwrap(parseOrgId('A'));
const orgB = unwrap(parseOrgId('B'));
const person = 'user:ns~p';
const inA = ['space:A~s1', 'organization:A', 'group:A~g1#member'];
const inB = ['space:B~s1', 'organization:B', 'group:B~g1#member'];
const malformed = [
  'space:s1',
  'space:A',
  'space:A~',
  'organization:A~x',
  ':A~s1',
];

function outcome(org: typeof orgA, ref: string): string {
  const r = requireSameOrg(org, [ref]);
  if (r.ok) return 'ok';
  assert.equal(r.error.message, 'not found');
  return r.error.code;
}

void test('V8: refs of the org and a person pass', () => {
  for (const ref of [...inA, person])
    assert.equal(outcome(orgA, ref), 'ok', ref);
  for (const ref of ['space:B~s1', person]) {
    assert.equal(outcome(orgB, ref), 'ok', ref);
  }
});

void test('V8: another org or a malformed ref is not_found and names no input', () => {
  for (const ref of [...inB, ...malformed]) {
    assert.equal(outcome(orgA, ref), ErrorCode.not_found, ref);
  }
  for (const ref of inA) {
    assert.equal(outcome(orgB, ref), ErrorCode.not_found, ref);
  }
});

void test('V8: one foreign ref among many fails the whole list', () => {
  assert.equal(requireSameOrg(orgA, [...inA, 'space:B~s1']).ok, false);
  assert.equal(requireSameOrg(orgA, []).ok, true);
});
