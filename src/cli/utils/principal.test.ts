import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOL_OBJECT_PREFIX } from './constants.ts';
import { AuthKind } from './credentials.ts';
import { CliUsage } from './failure.ts';
import { builderPrincipal, toolObject } from './principal.ts';

const PERSON = {
  principal: 'user:ns~caller',
  kind: AuthKind.enum.person,
} as const;
const SERVICE = {
  principal: 'service:ns~robot',
  kind: AuthKind.enum.service,
} as const;

void test('V8: builderPrincipal swaps the sub for a person and a service', () => {
  const person = builderPrincipal(PERSON, 'alice');
  assert.ok(person.ok);
  assert.equal(person.value, 'user:ns~alice');
  const service = builderPrincipal(SERVICE, 'alice');
  assert.ok(service.ok);
  assert.equal(service.value, 'service:ns~alice');
});

void test('V8: a bad sub is a CliUsage', () => {
  for (const sub of [
    'a~b',
    'a:b',
    'a#b',
    'a/b',
    'a b',
    '\t',
    '',
    'x'.repeat(300),
  ]) {
    const result = builderPrincipal(PERSON, sub);
    assert.ok(!result.ok, JSON.stringify(sub));
    assert.ok(result.error instanceof CliUsage);
  }
});

void test('V8: a principal with no namespace is refused', () => {
  assert.ok(
    !builderPrincipal({ principal: 'nobody', kind: AuthKind.enum.person }, 'a')
      .ok,
  );
});

void test('V8: toolObject builds tool:<org>~<key> and refuses a bad key', () => {
  const good = toolObject('desk', 'ok_key');
  assert.ok(good.ok);
  assert.equal(good.value, `${TOOL_OBJECT_PREFIX}desk~ok_key`);
  for (const key of ['bad key', 'a/b', 'a~b', 'a:b', 'a#b', '']) {
    assert.ok(!toolObject('desk', key).ok, JSON.stringify(key));
  }
});
