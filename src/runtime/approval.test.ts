import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvalVerdict, effectiveStake } from './approval.ts';
import type { ApprovalMemory } from './approval.ts';

const EMPTY: ApprovalMemory = { perKey: false, argumentHashes: new Set() };
const PER_KEY: ApprovalMemory = { perKey: true, argumentHashes: new Set() };
const HASH = 'abc123';
const WITH_HASH: ApprovalMemory = {
  perKey: false,
  argumentHashes: new Set([HASH]),
};
const OTHER_HASH: ApprovalMemory = {
  perKey: false,
  argumentHashes: new Set(['other']),
};
const FULL: ApprovalMemory = { perKey: true, argumentHashes: new Set([HASH]) };

// --- V3: approvalVerdict ---

void test('never_ask always runs', () => {
  assert.equal(approvalVerdict('never_ask', EMPTY, HASH), 'run');
});

void test('low blocks without per-key memory', () => {
  assert.equal(approvalVerdict('low', EMPTY, HASH), 'block');
});

void test('low runs with per-key memory', () => {
  assert.equal(approvalVerdict('low', PER_KEY, HASH), 'run');
});

void test('low blocks with only a hash row (no per-key)', () => {
  assert.equal(approvalVerdict('low', WITH_HASH, HASH), 'block');
});

void test('medium blocks with per-key only (no matching hash)', () => {
  assert.equal(approvalVerdict('medium', PER_KEY, HASH), 'block');
});

void test('medium runs with matching argument hash', () => {
  assert.equal(approvalVerdict('medium', WITH_HASH, HASH), 'run');
});

void test('medium blocks with a non-matching argument hash', () => {
  assert.equal(approvalVerdict('medium', OTHER_HASH, HASH), 'block');
});

void test('high always blocks even with per-key and matching hash', () => {
  assert.equal(approvalVerdict('high', FULL, HASH), 'block');
});

void test('unknown stake blocks (fail closed)', () => {
  // Cast simulates a stake value arriving from an unvalidated snapshot.
  assert.equal(approvalVerdict('unknown' as 'high', PER_KEY, HASH), 'block');
});

// --- V4: effectiveStake ---

void test('effectiveStake: null ref returns entry stake', () => {
  assert.equal(
    effectiveStake({ entry: { approval: 'low' }, approval: null }),
    'low',
  );
});

void test('effectiveStake: stricter ref wins (high > low)', () => {
  assert.equal(
    effectiveStake({ entry: { approval: 'low' }, approval: 'high' }),
    'high',
  );
});

void test('effectiveStake: stricter entry wins (medium > never_ask ref)', () => {
  assert.equal(
    effectiveStake({ entry: { approval: 'medium' }, approval: 'never_ask' }),
    'medium',
  );
});

void test('effectiveStake: entry high beats ref low', () => {
  assert.equal(
    effectiveStake({ entry: { approval: 'high' }, approval: 'low' }),
    'high',
  );
});
