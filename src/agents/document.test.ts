import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkStoredCaps,
  fillVersionLimits,
  parseAgentDocument,
} from './index.ts';

function fresh(): Record<string, unknown> {
  return {
    name: 'a',
    instructions: 'do',
    model: { provider: 'p', model: 'm', reasoningEffort: null },
    tools: [],
    memory: {
      workingMemoryScope: 'thread',
      messageHistory: { maxMessages: 1 },
    },
    limits: { maxSteps: 1, pauseTimeout: '1s', maxTraceOutputBytes: 1 },
  };
}

function setAt(path: string, value: unknown): Record<string, unknown> {
  const doc = fresh();
  const parts = path.split('.');
  const key = parts[parts.length - 1];
  if (key === undefined) throw new Error(path);
  let parent: Record<string, unknown> = doc;
  for (const part of parts.slice(0, -1)) {
    const next = parent[part];
    if (typeof next !== 'object' || next === null) {
      throw new Error(`missing ${path}`);
    }
    parent = next as Record<string, unknown>;
  }
  parent[key] = value;
  return doc;
}

function omit(value: unknown, parts: readonly string[]): unknown {
  const [head, ...rest] = parts;
  if (head === undefined) return value;
  if (typeof value !== 'object' || value === null) return value;
  const next: Record<string, unknown> = {};
  for (const [name, child] of Object.entries(value)) {
    if (name === head && rest.length === 0) continue;
    next[name] = name === head ? omit(child, rest) : child;
  }
  return next;
}

function drop(path: string): unknown {
  return omit(fresh(), path.split('.'));
}

function stored() {
  return {
    name: 'a',
    description: '',
    instructions: 'do',
    model: { provider: 'p', model: 'm', reasoningEffort: null },
    fallbacks: [],
    tools: [],
    memory: {
      workingMemoryScope: 'thread',
      messageHistory: { maxMessages: 1 },
    },
    limits: {
      maxSteps: 1,
      toolCallConcurrency: 1,
      maxToolCallsPerStep: 1,
      pauseTimeout: '1s',
      maxTraceOutputBytes: 1,
      maxRecoveries: 3,
    },
    workspace: null,
    skills: [],
    subagents: [],
  };
}

function accepted(raw: unknown) {
  const result = parseAgentDocument(raw);
  assert.equal(result.ok, true);
  return result.value;
}

function rejected(raw: unknown, field: string) {
  const result = parseAgentDocument(raw);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'invalid_argument');
  assert.equal(Object.hasOwn(result.error, 'cause'), false);
  assert.equal(
    result.error.message.includes(field),
    true,
    result.error.message,
  );
  assert.equal(result.error.message.includes('expected'), false);
  return result.error;
}

const required = [
  'name',
  'instructions',
  'model.provider',
  'model.model',
  'tools',
  'memory.workingMemoryScope',
  'memory.messageHistory.maxMessages',
];

void test('the trace cap may be omitted, and is refused as null', () => {
  accepted(drop('limits.maxTraceOutputBytes'));
  rejected(
    setAt('limits.maxTraceOutputBytes', null),
    'limits.maxTraceOutputBytes',
  );
});

void test('a minimal document stores every fallback', () => {
  assert.deepEqual(accepted(fresh()), stored());
});

void test('an unknown key is refused at every object', () => {
  rejected({ ...fresh(), extra: 1 }, 'extra');
  const doc = fresh();
  rejected(
    { ...doc, model: { ...(doc['model'] as object), extra: 1 } },
    'model.extra',
  );
  rejected(setAt('limits', { ...stored().limits, extra: 1 }), 'limits.extra');
  const tool = { key: 'zeta', implementationVersion: 1, extra: 1 };
  rejected({ ...fresh(), tools: [tool] }, 'tools.0.extra');
  rejected(
    {
      ...fresh(),
      memory: { ...(fresh()['memory'] as object), extra: 1 },
    },
    'memory.extra',
  );
  rejected(
    setAt('fallbacks', [
      { provider: 'p', model: 'm', reasoningEffort: null, extra: 1 },
    ]),
    'fallbacks.0.extra',
  );
});

void test('reasoningEffort stores low, stores null, and refuses omission', () => {
  const low = accepted(setAt('model.reasoningEffort', 'low'));
  assert.equal(low.model.reasoningEffort, 'low');
  assert.equal(accepted(fresh()).model.reasoningEffort, null);
  rejected(drop('model.reasoningEffort'), 'model.reasoningEffort');
});

void test('a required field is refused when omitted or null', () => {
  for (const field of required) {
    rejected(drop(field), field);
    rejected(setAt(field, null), field);
  }
});

void test('omitted fallbacks store the decisions table', () => {
  const value = accepted(fresh());
  assert.equal(value.limits.toolCallConcurrency, 1);
  assert.equal(value.limits.maxToolCallsPerStep, 1);
  assert.equal(value.limits.maxRecoveries, 3);
  assert.equal(value.description, '');
  assert.deepEqual(value.fallbacks, []);

  const explicit = accepted({
    ...fresh(),
    description: '',
    fallbacks: [],
    limits: {
      maxSteps: 1,
      pauseTimeout: '1s',
      maxTraceOutputBytes: 1,
      toolCallConcurrency: 1,
      maxToolCallsPerStep: 1,
      maxRecoveries: 3,
    },
  });
  assert.deepEqual(explicit, value);

  const raised = accepted(
    setAt('limits', {
      maxSteps: 1,
      pauseTimeout: '1s',
      maxTraceOutputBytes: 1,
      toolCallConcurrency: 4,
    }),
  );
  assert.equal(raised.limits.toolCallConcurrency, 4);
  assert.equal(raised.limits.maxToolCallsPerStep, 4);
  rejected(setAt('description', null), 'description');
  rejected(setAt('fallbacks', null), 'fallbacks');
  rejected(
    setAt('limits.toolCallConcurrency', null),
    'limits.toolCallConcurrency',
  );
  rejected(
    setAt('limits.maxToolCallsPerStep', null),
    'limits.maxToolCallsPerStep',
  );
  rejected(setAt('limits.maxRecoveries', null), 'limits.maxRecoveries');
});

void test('slots store only empty values', () => {
  const filled = accepted({
    ...fresh(),
    workspace: null,
    skills: [],
    subagents: [],
  });
  assert.equal(filled.workspace, null);
  assert.deepEqual(filled.skills, []);
  assert.deepEqual(filled.subagents, []);
  assert.deepEqual(filled, accepted(fresh()));

  const workspace = rejected(setAt('workspace', {}), 'workspace');
  assert.equal(workspace.message.includes('7'), true);
  assert.equal(workspace.message.includes('9'), true);
  const skills = rejected(setAt('skills', [{}]), 'skills');
  assert.equal(skills.message.includes('11'), true);
  const subagents = rejected(setAt('subagents', [{}]), 'subagents');
  assert.equal(subagents.message.includes('12'), true);
  rejected(setAt('skills', null), 'skills');
  rejected(setAt('subagents', null), 'subagents');
});

void test('tools stay in author order and refuse a bad ref', () => {
  const tools = [
    { key: 'zeta', implementationVersion: 1 },
    { key: 'a.b-c_2', implementationVersion: 3 },
  ];
  assert.deepEqual(accepted({ ...fresh(), tools }).tools, [
    { key: 'zeta', implementationVersion: 1, config: null, approval: null },
    { key: 'a.b-c_2', implementationVersion: 3, config: null, approval: null },
  ]);
  const duplicate = rejected(
    {
      ...fresh(),
      tools: [
        { key: 'zeta', implementationVersion: 1 },
        { key: 'zeta', implementationVersion: 2 },
      ],
    },
    'tools',
  );
  assert.equal(duplicate.message.includes('zeta'), false);
  const badKey = rejected(
    { ...fresh(), tools: [{ key: 'Bad Key', implementationVersion: 1 }] },
    'tools',
  );
  assert.equal(badKey.message.includes('Bad Key'), false);
  rejected(
    { ...fresh(), tools: [{ key: 'zeta', implementationVersion: 0 }] },
    'implementationVersion',
  );
  rejected(
    { ...fresh(), tools: [{ key: 'zeta', implementationVersion: 1.5 }] },
    'implementationVersion',
  );
});

void test('a rejected value is absent from every error field', () => {
  const steps = rejected(
    setAt('limits.maxSteps', 'SECRET-MARKER-7'),
    'limits.maxSteps',
  );
  assert.equal(JSON.stringify(steps).includes('SECRET-MARKER-7'), false);
  const named = rejected(
    { ...fresh(), instructions: 'SECRET-MARKER-8', name: 12345 },
    'name',
  );
  const shown = JSON.stringify(named);
  assert.equal(shown.includes('SECRET-MARKER-8'), false);
  assert.equal(shown.includes('12345'), false);
});

void test('each bound has one accepted and one rejected value', () => {
  const chars = (n: number) => 'a'.repeat(n);
  const cases: { path: string; ok: unknown; bad: unknown }[] = [
    { path: 'name', ok: chars(200), bad: chars(201) },
    { path: 'description', ok: chars(2_000), bad: chars(2_001) },
    { path: 'instructions', ok: chars(100_000), bad: chars(100_001) },
    { path: 'limits.maxSteps', ok: 1, bad: 0 },
    { path: 'memory.messageHistory.maxMessages', ok: 1, bad: 0 },
    { path: 'limits.toolCallConcurrency', ok: 1, bad: 0 },
    { path: 'limits.maxToolCallsPerStep', ok: 1, bad: 0 },
    { path: 'limits.maxTraceOutputBytes', ok: 1, bad: 0 },
    { path: 'limits.maxRecoveries', ok: 0, bad: -1 },
    { path: 'limits.pauseTimeout', ok: '1s', bad: '0s' },
    { path: 'memory.workingMemoryScope', ok: 'resource', bad: 'user' },
    { path: 'name', ok: 'a', bad: ' a' },
  ];
  for (const row of cases) {
    accepted(setAt(row.path, row.ok));
    rejected(setAt(row.path, row.bad), row.path);
  }
  rejected(setAt('limits.maxSteps', 1.5), 'limits.maxSteps');
  rejected(setAt('description', ' a'), 'description');
  rejected(setAt('model.provider', ' p'), 'model.provider');
});

void test('tool config and approval store null unless set', () => {
  const omitted = accepted({
    ...fresh(),
    tools: [{ key: 'zeta', implementationVersion: 1 }],
  });
  const cleared = accepted({
    ...fresh(),
    tools: [
      { key: 'zeta', implementationVersion: 1, config: null, approval: null },
    ],
  });
  assert.deepEqual(omitted, cleared);
  const [omittedTool] = omitted.tools;
  assert.ok(omittedTool);
  assert.equal(omittedTool.config, null);
  assert.equal(omittedTool.approval, null);
  const set = accepted({
    ...fresh(),
    tools: [
      {
        key: 'zeta',
        implementationVersion: 1,
        approval: 'low',
        config: { a: 1 },
      },
    ],
  });
  const [setTool] = set.tools;
  assert.ok(setTool);
  assert.equal(setTool.approval, 'low');
  assert.deepEqual(setTool.config, { a: 1 });
  rejected(
    {
      ...fresh(),
      tools: [{ key: 'zeta', implementationVersion: 1, approval: 'nope' }],
    },
    'approval',
  );
  rejected(
    {
      ...fresh(),
      tools: [{ key: 'zeta', implementationVersion: 1, config: [] }],
    },
    'config',
  );
});

const snapshot = {
  maxSteps: 9,
  pauseTimeout: '9h',
  maxTraceOutputBytes: 90,
  maxToolsPerVersion: 2,
  maxFallbacks: 1,
};

void test('an omitted version field is filled from the snapshot and a set value is kept', () => {
  const omitted = fillVersionLimits(
    accepted(drop('limits.maxSteps')),
    snapshot,
  );
  assert.equal(omitted.limits.maxSteps, 9);
  const set = fillVersionLimits(
    accepted(setAt('limits.maxSteps', 40)),
    snapshot,
  );
  assert.equal(set.limits.maxSteps, 40);
  assert.equal(set.limits.maxToolsPerVersion, 2);
  assert.equal(set.limits.maxFallbacks, 1);
  assert.equal(set.limits.pauseTimeout, '1s');
  assert.equal(set.limits.maxTraceOutputBytes, 1);
  for (const field of [
    'limits.maxSteps',
    'limits.pauseTimeout',
    'limits.maxTraceOutputBytes',
    'limits.maxToolsPerVersion',
    'limits.maxFallbacks',
  ]) {
    accepted(drop(field));
  }
  accepted(setAt('limits.maxToolsPerVersion', 0));
  accepted(setAt('limits.maxFallbacks', 0));
  rejected(setAt('limits.maxToolsPerVersion', -1), 'limits.maxToolsPerVersion');
  rejected(setAt('limits.maxFallbacks', -1), 'limits.maxFallbacks');
  accepted(setAt('limits.maxSteps', 10_000));
  accepted(setAt('limits.maxTraceOutputBytes', 10_000));
});

void test('tools and fallbacks are checked against the stored caps', () => {
  const filled = fillVersionLimits(accepted(fresh()), snapshot);
  assert.equal(checkStoredCaps(filled).ok, true);
  const overTools = {
    ...filled,
    tools: [
      { key: 'a', implementationVersion: 1, config: null, approval: null },
      { key: 'b', implementationVersion: 1, config: null, approval: null },
      { key: 'c', implementationVersion: 1, config: null, approval: null },
    ],
  };
  const tools = checkStoredCaps(overTools);
  assert.equal(tools.ok, false);
  assert.match(tools.error.message, /tools/u);
  const overFallbacks = {
    ...filled,
    fallbacks: [
      { provider: 'p', model: 'm', reasoningEffort: null },
      { provider: 'q', model: 'n', reasoningEffort: null },
    ],
  };
  const fallbacks = checkStoredCaps(overFallbacks);
  assert.equal(fallbacks.ok, false);
  assert.match(fallbacks.error.message, /fallbacks/u);
});
