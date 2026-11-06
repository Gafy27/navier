import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliFailure } from '../../utils/failure.ts';
import { parseDeployManifest } from './manifest.ts';

const VALID = `
id: desk_orders
name: Orders Desk
space: desk
published: true
tools: [desk_lookup_order, desk_refund_order]
members: ['user:ns~bob']
instructions: Look an order up first.
memory:
  workingMemoryScope: thread
  messageHistory: { maxMessages: 20 }
`;

void test('V32: a flat file splits into deploy fields and the forwarded document', () => {
  const manifest = parseDeployManifest(VALID);
  assert.equal(manifest.id, 'desk_orders');
  assert.equal(manifest.space, 'desk');
  assert.deepEqual(manifest.tools, ['desk_lookup_order', 'desk_refund_order']);
  assert.deepEqual(manifest.members, ['user:ns~bob']);
  assert.equal(manifest.published, true);
  assert.deepEqual(manifest.document, {
    name: 'Orders Desk',
    instructions: 'Look an order up first.',
    memory: {
      workingMemoryScope: 'thread',
      messageHistory: { maxMessages: 20 },
    },
  });
});

void test('V32: members default to an empty list', () => {
  const manifest = parseDeployManifest(
    'id: a\nspace: s\npublished: false\ntools: []\n',
  );
  assert.deepEqual(manifest.members, []);
  assert.deepEqual(manifest.document, {});
});

void test('V32: a key named key at depth 3 is refused, naming only the key', () => {
  const text = `${VALID}  extra:\n    key: sk-depth-three-value\n`;
  assert.throws(
    () => parseDeployManifest(text),
    (cause: unknown) =>
      cause instanceof CliFailure &&
      cause.message.endsWith(': key') &&
      !cause.message.includes('sk-depth-three-value'),
  );
});

for (const name of ['clientSecret', 'token', 'password', 'secret']) {
  void test(`V32: a top-level ${name} is refused`, () => {
    assert.throws(
      () => parseDeployManifest(`${VALID}${name}: hunter2-value\n`),
      (cause: unknown) =>
        cause instanceof CliFailure &&
        cause.message.endsWith(`: ${name}`) &&
        !cause.message.includes('hunter2-value'),
    );
  });
}

void test('V32: a secret-named key inside a list item is refused', () => {
  assert.throws(
    () => parseDeployManifest(`${VALID}steps:\n  - token: abc\n`),
    CliFailure,
  );
});

void test('V32 (owner Q2=A): an unknown top-level key is forwarded in the document for the API to refuse', () => {
  const manifest = parseDeployManifest(`${VALID}extra: 1\n`);
  assert.equal(manifest.document['extra'], 1);
});

void test('V32: a missing space, a non-list tools, and a non-mapping file are refused', () => {
  for (const text of [
    'id: a\npublished: true\ntools: []\n',
    'id: a\nspace: s\npublished: true\ntools: one\n',
    '- id: a\n',
  ]) {
    assert.throws(() => parseDeployManifest(text), CliFailure);
  }
});

void test('bad YAML and an empty file are refused without echoing the text', () => {
  for (const text of ['id: [unclosed-secret-text', '']) {
    assert.throws(
      () => parseDeployManifest(text),
      (cause: unknown) =>
        cause instanceof CliFailure &&
        !cause.message.includes('unclosed-secret-text'),
    );
  }
});
