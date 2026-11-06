import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAgentDocument } from '../agents/index.ts';
import { z } from '../index.ts';
import { Agent, toAgentDocument } from './agent.ts';
import type { AgentConfig } from './agent.ts';
import { SdkError } from './errors.ts';
import { createTool } from './tool.ts';

const VERSION = 1;
const LAST_MESSAGES = 10;
const MAX_STEPS = 5;
const PAUSE = '1h';

const tool = (id: string) =>
  createTool({
    id,
    version: VERSION,
    description: id,
    inputSchema: z.object({}),
    execute: () => Promise.resolve({ ok: true }),
  });
const toolA = tool('tool_a');
const toolB = tool('tool_b');

const base: AgentConfig = {
  id: 'support',
  name: 'Support',
  instructions: 'help',
  model: 'anthropic/claude-x',
  reasoningEffort: null,
  memory: { lastMessages: LAST_MESSAGES, workingMemory: { scope: 'thread' } },
  limits: { maxSteps: MAX_STEPS, pauseTimeout: PAUSE },
};

function refusedFor(over: object, path: string): void {
  assert.throws(
    () => new Agent({ ...base, ...over }),
    (e: unknown) => {
      assert.ok(e instanceof SdkError);
      assert.equal(e.code, 'invalid_argument');
      assert.ok(e.message.includes(path), e.message);
      return true;
    },
  );
}

void test('V5: a minimal config builds the D5 document', () => {
  const agent = new Agent(base);
  const { document, tools } = toAgentDocument(agent);
  assert.equal(agent.id, base.id);
  assert.equal(parseAgentDocument(document).ok, true);
  assert.deepEqual(document.model, {
    provider: 'anthropic',
    model: 'claude-x',
    reasoningEffort: null,
  });
  assert.deepEqual(document.tools, []);
  assert.deepEqual(document.memory, {
    workingMemoryScope: 'thread',
    messageHistory: { maxMessages: LAST_MESSAGES },
  });
  assert.equal(document.workspace, null);
  assert.deepEqual(document.skills, []);
  assert.deepEqual(document.subagents, []);
  assert.deepEqual(tools, []);
});

void test('V5: a model splits at the first slash, fallbacks the same', () => {
  const { document } = toAgentDocument(
    new Agent({
      ...base,
      model: 'openai/ft:a/b',
      fallbacks: [{ model: 'x/y', reasoningEffort: 'low' }],
    }),
  );
  assert.equal(document.model.model, 'ft:a/b');
  assert.deepEqual(document.fallbacks, [
    { provider: 'x', model: 'y', reasoningEffort: 'low' },
  ]);
});

void test('V5: bad values are refused, naming the config path', () => {
  refusedFor({ instructions: () => 'x' }, 'instructions');
  refusedFor({ model: 'noslash' }, 'model');
  refusedFor(
    { fallbacks: [{ model: 'noslash', reasoningEffort: null }] },
    'fallbacks.0.model',
  );
  refusedFor(
    { memory: { ...base.memory, lastMessages: 0 } },
    'memory.lastMessages',
  );
  refusedFor({ limits: { pauseTimeout: PAUSE } }, 'limits.maxSteps');
  refusedFor(
    { memory: { ...base.memory, workingMemory: { scope: 'resource' } } },
    'memory.workingMemory.scope',
  );
});

void test('V6: tools keep author order and take the stored name from tool.id', () => {
  const { document, tools } = toAgentDocument(
    new Agent({ ...base, tools: { b: toolB, a: toolA } }),
  );
  assert.deepEqual(
    document.tools.map((ref) => ref.key),
    [toolB.id, toolA.id],
  );
  assert.deepEqual(tools, [toolB, toolA]);
});

void test('V6: two entries with one tool id are refused, naming the second key', () => {
  refusedFor({ tools: { x: toolA, y: toolA } }, 'tools.y');
});
