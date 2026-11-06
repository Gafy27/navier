import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  canonicalHash,
  definitionHash,
  parseStoredDefinition,
} from './index.ts';
import type { AgentDefinition } from './index.ts';

const one = { provider: 'p', model: 'one', reasoningEffort: 'low' };
const two = { provider: 'q', model: 'two', reasoningEffort: null };
const zeta = {
  key: 'zeta',
  implementationVersion: 1,
  config: { b: 1, a: 2 },
  approval: 'low',
};
const alpha = { key: 'alpha', implementationVersion: 1 };

function fixture(patch: Record<string, unknown> = {}) {
  return {
    name: 'a',
    instructions: 'do',
    model: { provider: 'p', model: 'm', reasoningEffort: 'low' },
    fallbacks: [one, two],
    tools: [zeta, alpha],
    memory: {
      workingMemoryScope: 'thread',
      messageHistory: { maxMessages: 1 },
    },
    limits: {
      maxSteps: 1,
      pauseTimeout: '1s',
      maxTraceOutputBytes: 1,
      maxToolsPerVersion: 0,
      maxFallbacks: 0,
    },
    ...patch,
  };
}

function parsed(raw: unknown): AgentDefinition {
  const result = parseStoredDefinition(raw);
  if (!result.ok) assert.fail(result.error.message);
  return result.value;
}

function independentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => reverseKeys(item));
  if (typeof value !== 'object' || value === null) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).reverse()) {
    out[key] = reverseKeys(source[key]);
  }
  return out;
}

const canonical = {
  description: '',
  fallbacks: [
    { model: 'one', provider: 'p', reasoningEffort: 'low' },
    { model: 'two', provider: 'q', reasoningEffort: null },
  ],
  instructions: 'do',
  limits: {
    maxFallbacks: 0,
    maxRecoveries: 3,
    maxSteps: 1,
    maxToolCallsPerStep: 1,
    maxToolsPerVersion: 0,
    maxTraceOutputBytes: 1,
    pauseTimeout: '1s',
    toolCallConcurrency: 1,
  },
  memory: {
    messageHistory: { maxMessages: 1 },
    workingMemoryScope: 'thread',
  },
  model: { model: 'm', provider: 'p', reasoningEffort: 'low' },
  name: 'a',
  skills: [],
  subagents: [],
  tools: [
    {
      approval: 'low',
      config: { a: 2, b: 1 },
      implementationVersion: 1,
      key: 'zeta',
    },
    {
      approval: null,
      config: null,
      implementationVersion: 1,
      key: 'alpha',
    },
  ],
  workspace: null,
};

void test('key order and written fallbacks keep one hash', () => {
  const hash = definitionHash(parsed(fixture()));
  const sha = independentDigest(canonical);
  assert.equal(hash, sha);
  assert.match(hash, /^[0-9a-f]{64}$/);
  const reversed = reverseKeys(parsed(fixture())) as AgentDefinition;
  assert.equal(definitionHash(reversed), hash);

  const written = fixture({
    description: '',
    limits: {
      maxSteps: 1,
      pauseTimeout: '1s',
      maxTraceOutputBytes: 1,
      maxToolsPerVersion: 0,
      maxFallbacks: 0,
      toolCallConcurrency: 1,
      maxToolCallsPerStep: 1,
      maxRecoveries: 3,
    },
  });
  assert.equal(definitionHash(parsed(written)), hash);

  const { fallbacks, ...omitted } = fixture();
  assert.ok(fallbacks.length > 0);
  const empty = definitionHash(parsed(fixture({ fallbacks: [] })));
  assert.equal(definitionHash(parsed(omitted)), empty);
  assert.notEqual(definitionHash(parsed(omitted)), hash);
});

// --- V5: canonicalHash ---

void test('canonicalHash: key order is irrelevant, array order is not', () => {
  const base = canonicalHash({ a: 1, b: [1, 2] });
  assert.match(base, /^[0-9a-f]{64}$/);
  // same keys, different order → same hash
  assert.equal(canonicalHash({ b: [1, 2], a: 1 }), base);
  // nested key order → same hash
  assert.equal(
    canonicalHash({ x: { q: 1, p: 2 } }),
    canonicalHash({ x: { p: 2, q: 1 } }),
  );
  // array order differs → different hash
  assert.notEqual(canonicalHash({ b: [2, 1], a: 1 }), base);
  // string "1" vs number 1 → different hash
  assert.notEqual(canonicalHash({ a: '1', b: [1, 2] }), base);
  // extra field → different hash
  assert.notEqual(canonicalHash({ a: 1, b: [1, 2], requestId: 'r1' }), base);
});

void test('canonicalHash and definitionHash agree on a parsed definition', () => {
  const d = parsed(fixture());
  assert.equal(definitionHash(d), canonicalHash(d));
  assert.equal(canonicalHash(d), independentDigest(canonical));
});

void test('a changed definition field changes the hash', () => {
  const hash = definitionHash(parsed(fixture()));
  const patches = [
    { instructions: 'dO' },
    { model: { provider: 'p', model: 'm', reasoningEffort: null } },
    { fallbacks: [two, one] },
    { tools: [alpha, zeta] },
    { tools: [{ ...zeta, approval: 'high' }, alpha] },
    { tools: [{ ...zeta, config: { b: 1, a: 3 } }, alpha] },
  ];
  for (const patch of patches) {
    assert.notEqual(definitionHash(parsed(fixture(patch))), hash);
  }
});
