import assert from 'node:assert/strict';
import { test } from 'node:test';
import { policyKey } from './policy.ts';
import { recheckResolution, walkModels } from './resolve.ts';
import type { ModelChoice, ModelPolicy } from './schema.ts';

const choice = (model: string): ModelChoice => ({
  provider: 'p',
  model,
  reasoningEffort: 'low',
});

function policies(
  ...rows: [string, boolean, boolean][]
): Map<string, ModelPolicy> {
  return new Map(
    rows.map(([model, enabled, degraded]) => [
      policyKey(choice(model)),
      { provider: 'p', model, enabled, degraded },
    ]),
  );
}

void test('skips disabled and degraded candidates and takes the first fallback', () => {
  const r = walkModels(
    undefined,
    { model: choice('m1'), fallbacks: [choice('m2'), choice('m3')] },
    policies(['m1', false, false], ['m2', true, true], ['m3', true, false]),
  );
  assert.deepEqual(r, {
    kind: 'resolved',
    choice: choice('m3'),
    method: 'fallback',
  });
});

void test('a usable selection wins; an unusable one falls through to the version model', () => {
  const version = { model: choice('m3'), fallbacks: [] };
  const all = policies(
    ['m1', false, false],
    ['m2', true, true],
    ['m3', true, false],
  );
  const method = (selection: ModelChoice | undefined) => {
    const r = walkModels(selection, version, all);
    return r.kind === 'resolved' ? [r.choice.model, r.method] : r.kind;
  };
  assert.deepEqual(method(choice('m3')), ['m3', 'selection']);
  assert.deepEqual(method(undefined), ['m3', 'version']);
  assert.deepEqual(method(choice('m1')), ['m3', 'version']);
  assert.deepEqual(method(choice('m2')), ['m3', 'version']);
  assert.deepEqual(method(choice('mX')), ['m3', 'version']);
});

void test('none usable, or no policy rows, is none_enabled', () => {
  const version = { model: choice('m1'), fallbacks: [choice('m2')] };
  assert.deepEqual(
    walkModels(
      undefined,
      version,
      policies(['m1', false, false], ['m2', false, false]),
    ),
    { kind: 'none_enabled' },
  );
  assert.deepEqual(walkModels(undefined, version, policies()), {
    kind: 'none_enabled',
  });
});

void test('recheck keeps an enabled stored model, degraded or not', () => {
  const fallbacks = [choice('F')];
  const recheck = (...rows: [string, boolean, boolean][]) =>
    recheckResolution(policies(...rows), choice('S'), fallbacks);
  assert.deepEqual(recheck(['S', true, false], ['F', true, false]), {
    kind: 'kept',
  });
  assert.deepEqual(recheck(['S', true, true], ['F', true, false]), {
    kind: 'kept',
  });
});

void test('recheck takes the first enabled fallback, degraded or not, else none_enabled', () => {
  const fallbacks = [choice('F'), choice('G')];
  const recheck = (...rows: [string, boolean, boolean][]) =>
    recheckResolution(policies(...rows), choice('S'), fallbacks);
  const onF = { kind: 'fallback', choice: choice('F') };
  assert.deepEqual(recheck(['S', false, false], ['F', true, false]), onF);
  assert.deepEqual(recheck(['S', false, false], ['F', true, true]), onF);
  assert.deepEqual(
    recheck(['S', false, false], ['F', false, false], ['G', true, false]),
    { kind: 'fallback', choice: choice('G') },
  );
  assert.deepEqual(
    recheck(['S', false, false], ['F', false, false], ['G', false, false]),
    { kind: 'none_enabled' },
  );
  assert.deepEqual(recheck(), { kind: 'none_enabled' });
});
