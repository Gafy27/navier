import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StreamEvent } from '../../../client/index.ts';
import { CliFailure } from '../../utils/failure.ts';
import { CHAT_TOOL_INPUT_PREVIEW_MAX, renderFrame } from './render.ts';
import type { ChatActionState } from './render.ts';

function sink(): {
  readonly out: { stdout: (s: string) => void; stderr: (s: string) => void };
  readonly text: () => string;
} {
  let text = '';
  return {
    out: {
      stdout: (s) => {
        text += s;
      },
      stderr: () => undefined,
    },
    text: () => text,
  };
}

const action: StreamEvent = {
  id: '1',
  kind: 'action',
  data: { actionId: 'a', toolKey: 'tool:one', arguments: { q: 'v' } },
};

void test('reasoning is dim, text is plain, steps print nothing', () => {
  const s = sink();
  const state: ChatActionState = new Map();
  renderFrame(
    { id: '1', kind: 'delta', delta: 'reasoning', traceId: 't', text: 'r' },
    s.out,
    state,
  );
  renderFrame(
    { id: '2', kind: 'delta', delta: 'text', traceId: 't', text: 'x' },
    s.out,
    state,
  );
  assert.equal(
    renderFrame({ id: '3', kind: 'step', data: {} }, s.out, state),
    'continue',
  );
  assert.equal(s.text(), '\u001B[2mr\u001B[22mx');
});

void test('an action fills the state and a tool prints one line from it', () => {
  const s = sink();
  const state: ChatActionState = new Map();
  assert.equal(renderFrame(action, s.out, state), 'continue');
  assert.equal(s.text(), '');
  renderFrame(
    { id: '2', kind: 'tool', data: { actionId: 'a', isError: false } },
    s.out,
    state,
  );
  assert.equal(s.text(), '\ntool tool:one {"q":"v"}\n');
});

void test('a long preview is cut to the cap and an error is marked', () => {
  const s = sink();
  const state: ChatActionState = new Map();
  renderFrame(
    {
      id: '1',
      kind: 'action',
      data: {
        actionId: 'a',
        toolKey: 'k',
        arguments: 'y'.repeat(CHAT_TOOL_INPUT_PREVIEW_MAX * 2),
      },
    },
    s.out,
    state,
  );
  renderFrame(
    { id: '2', kind: 'tool', data: { actionId: 'a', isError: true } },
    s.out,
    state,
  );
  assert.equal(s.text().trim().length, CHAT_TOOL_INPUT_PREVIEW_MAX);
  const short = sink();
  const other: ChatActionState = new Map();
  renderFrame(action, short.out, other);
  renderFrame(
    { id: '2', kind: 'tool', data: { actionId: 'a', isError: true } },
    short.out,
    other,
  );
  assert.ok(short.text().trim().endsWith('error'));
});

void test('a tool before its action fails; blocked and terminal go to the caller', () => {
  const s = sink();
  assert.throws(
    () =>
      renderFrame(
        { id: '1', kind: 'tool', data: { actionId: 'a', isError: false } },
        s.out,
        new Map(),
      ),
    CliFailure,
  );
  const blocked: StreamEvent = {
    id: '2',
    kind: 'blocked',
    actions: [{ actionId: 'a', kind: 'approval', canRemember: true }],
  };
  assert.deepEqual(renderFrame(blocked, s.out, new Map()), { blocked });
  assert.deepEqual(
    renderFrame(
      { id: '3', kind: 'terminal', status: 'succeeded' },
      s.out,
      new Map(),
    ),
    { terminal: 'succeeded' },
  );
});
