import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ModelChoiceSchema,
  parseModelPolicy,
  readModelPolicy,
} from './schema.ts';

const secret = 'super-secret-model-token';

function message(raw: unknown): string {
  const parsed = parseModelPolicy(raw);
  if (parsed.ok) assert.fail('expected invalid');
  return parsed.error.message;
}

void test('parseModelPolicy returns the policy fields', () => {
  const parsed = parseModelPolicy({
    provider: 'openai',
    model: 'gpt',
    enabled: true,
    degraded: false,
  });
  assert.deepEqual(parsed, {
    ok: true,
    value: { provider: 'openai', model: 'gpt', enabled: true, degraded: false },
  });
});

void test('parseModelPolicy names the field and never the value', () => {
  const cases: readonly [unknown, string][] = [
    [
      { provider: ` ${secret}`, model: 'm', enabled: true, degraded: false },
      'provider: invalid',
    ],
    [
      { provider: 'p', model: '', enabled: true, degraded: false },
      'model: invalid',
    ],
    [
      { provider: 'p', model: 'm', enabled: 'yes', degraded: false },
      'enabled: invalid',
    ],
    [
      {
        provider: 'p',
        model: 'm',
        enabled: true,
        degraded: false,
        token: secret,
      },
      'token: invalid',
    ],
    [
      {},
      'degraded: invalid, enabled: invalid, model: invalid, provider: invalid',
    ],
  ];
  for (const [raw, expected] of cases) {
    const text = message(raw);
    assert.equal(text, expected);
    assert.equal(text.includes(secret), false);
  }
});

void test('a model choice requires effort and refuses surrounding space', () => {
  const base = { provider: 'p', model: 'm', reasoningEffort: null };
  assert.equal(ModelChoiceSchema.safeParse(base).success, true);
  assert.equal(
    ModelChoiceSchema.safeParse({ ...base, reasoningEffort: 'low' }).success,
    true,
  );
  assert.equal(
    ModelChoiceSchema.safeParse({ provider: 'p', model: 'm' }).success,
    false,
  );
  assert.equal(
    ModelChoiceSchema.safeParse({ ...base, provider: ` ${secret}` }).success,
    false,
  );
});

void test('readModelPolicy throws without the stored value', () => {
  assert.deepEqual(
    readModelPolicy({
      provider: 'p',
      model: 'm',
      enabled: true,
      degraded: false,
    }),
    { provider: 'p', model: 'm', enabled: true, degraded: false },
  );
  assert.throws(
    () =>
      readModelPolicy({
        provider: 'p',
        model: 'm',
        enabled: secret,
        degraded: false,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(
        error.message,
        'model_policy row is invalid: enabled: invalid',
      );
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});
