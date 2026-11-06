import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ErrorCode } from '../index.ts';
import { SdkError } from '../sdk/index.ts';
import { parsePerson, parseProjectId, parseToolKey } from './project-admin.ts';

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (e) {
    assert.ok(e instanceof SdkError);
    assert.equal(e.code, ErrorCode.invalid_argument);
    return e.message;
  }
  return undefined;
}

void test('project ids follow the agent id grammar', () => {
  assert.equal(parseProjectId('desk'), 'desk');
  assert.equal(
    codeOf(() => parseProjectId('Bad:Id')),
    'project: invalid',
  );
  assert.equal(
    codeOf(() => parseProjectId('has space')),
    'project: invalid',
  );
  assert.equal(
    codeOf(() => parseProjectId('')),
    'project: invalid',
  );
});

void test('a person is a user principal; an agent id is refused', () => {
  assert.equal(parsePerson('user:corp~alice'), 'user:corp~alice');
  assert.equal(
    codeOf(() => parsePerson('agent:corp~alice')),
    'person: invalid',
  );
  assert.equal(
    codeOf(() => parsePerson('not a principal')),
    'person: invalid',
  );
});

void test('a tool key follows the tool grammar', () => {
  assert.equal(parseToolKey('lookup_order'), 'lookup_order');
  assert.equal(
    codeOf(() => parseToolKey('bad key')),
    'tool: invalid',
  );
});
