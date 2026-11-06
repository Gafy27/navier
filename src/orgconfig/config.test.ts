import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OrgSnapshotSchema,
  parseOrgFirstRow,
  parseOrgPatch,
  parseOrgSnapshot,
  pauseTimeoutSchema,
} from './config.ts';

const secret = 'super-secret-timeout';

const minimum = {
  maxToolsPerVersion: 0,
  maxFallbacks: 0,
  maxSteps: 1,
  pauseTimeout: '1h',
  maxTraceOutputBytes: 1,
  maxToolOutputBytes: 1,
  maxToolAttempts: 1,
};

const streamMinimum = {
  streamReplayTtl: '1s',
  streamAccessRecheck: '1m',
  streamPollHold: '1h',
  streamKeepalive: '1d',
  streamMaxLifetime: '2s',
  maxStreamDeltasPerMessage: 1,
};

const aboveCeiling = {
  maxToolsPerVersion: 16,
  maxFallbacks: 2,
  maxSteps: 11,
  pauseTimeout: '8d',
  maxTraceOutputBytes: 65537,
  maxToolOutputBytes: 65537,
  maxToolAttempts: 4,
};

void test('snapshot shapes accept the minimum and a value above the old ceiling', () => {
  assert.equal(
    OrgSnapshotSchema.safeParse({ ...minimum, ...streamMinimum }).success,
    true,
  );
  assert.equal(
    OrgSnapshotSchema.safeParse({ ...aboveCeiling, ...streamMinimum }).success,
    true,
  );
  for (const duration of ['1s', '2m', '3h', '4d']) {
    assert.equal(pauseTimeoutSchema.safeParse(duration).success, true);
  }
});

void test('snapshot shapes refuse a value under the minimum and name the field', () => {
  const under: readonly [string, unknown][] = [
    ['maxToolsPerVersion', -1],
    ['maxFallbacks', -1],
    ['maxSteps', 0],
    ['pauseTimeout', '0h'],
    ['maxTraceOutputBytes', 0],
    ['maxToolOutputBytes', 0],
    ['maxToolAttempts', 0],
  ];
  for (const [field, value] of under) {
    const parsed = parseOrgSnapshot({
      ...minimum,
      ...streamMinimum,
      [field]: value,
    });
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, 'invalid_argument');
    assert.equal(parsed.error.message.includes(field), true);
    assert.equal(parsed.error.message.includes(secret), false);
    assert.equal(parsed.error.message.includes(String(value)), false);
  }
  const timed = parseOrgSnapshot({
    ...minimum,
    ...streamMinimum,
    pauseTimeout: `0h${secret}`,
  });
  assert.equal(timed.ok, false);
  assert.equal(timed.error.message.includes(secret), false);
});

void test('a partial names a missing field and an unknown key', () => {
  const six = {
    maxToolsPerVersion: minimum.maxToolsPerVersion,
    maxFallbacks: minimum.maxFallbacks,
    maxSteps: minimum.maxSteps,
    pauseTimeout: minimum.pauseTimeout,
    maxTraceOutputBytes: minimum.maxTraceOutputBytes,
    maxToolOutputBytes: minimum.maxToolOutputBytes,
  };
  const missing = parseOrgFirstRow(six);
  assert.equal(missing.ok, false);
  assert.equal(missing.error.message, 'maxToolAttempts: invalid');
  const extra = parseOrgPatch({ ...minimum, token: secret });
  assert.equal(extra.ok, false);
  assert.equal(extra.error.message, 'token: invalid');
  assert.equal(extra.error.message.includes(secret), false);
});

const durationFields = [
  'streamReplayTtl',
  'streamAccessRecheck',
  'streamPollHold',
  'streamKeepalive',
  'streamMaxLifetime',
] as const;

void test('D10 refuses a zero or malformed duration and a cap under 1, naming the field only', () => {
  const bad: readonly (readonly [string, readonly unknown[]])[] = [
    ...durationFields.map(
      (field) =>
        [field, ['0s', '0m', '00h', '0', '5x', `0s${secret}`]] as const,
    ),
    ['maxStreamDeltasPerMessage', [0, -1, 1.5]],
  ];
  for (const [field, values] of bad) {
    for (const value of values) {
      for (const parse of [parseOrgPatch, parseOrgFirstRow]) {
        const parsed = parse({ ...minimum, [field]: value });
        assert.equal(parsed.ok, false);
        assert.equal(parsed.error.code, 'invalid_argument');
        assert.equal(parsed.error.message, `${field}: invalid`);
      }
    }
  }
});

void test('D10 has no maximum', () => {
  const large = {
    ...streamMinimum,
    streamReplayTtl: '9999d',
    maxStreamDeltasPerMessage: Number.MAX_SAFE_INTEGER,
  };
  assert.equal(
    OrgSnapshotSchema.safeParse({ ...minimum, ...large }).success,
    true,
  );
});

void test('a first row names each missing D2 field and needs no D10 field', () => {
  const none = parseOrgFirstRow({});
  assert.equal(none.ok, false);
  assert.equal(
    none.error.message,
    Object.keys(minimum)
      .sort()
      .map((field) => `${field}: invalid`)
      .join(', '),
  );
  assert.deepEqual(parseOrgFirstRow(minimum), { ok: true, value: minimum });
  const oneStream = { ...minimum, streamPollHold: '7s' };
  assert.deepEqual(parseOrgFirstRow(oneStream), { ok: true, value: oneStream });
  assert.equal(parseOrgSnapshot(minimum).ok, false);
});
