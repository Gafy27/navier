import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { z } from '../../../index.ts';
import { StopKind } from '../../../runtime/index.ts';
import { CheckKind, Method } from '../../adapter/route-types.ts';
import {
  approveBlockedAction,
  chatRoutes,
  CONVERSATION_OBJECT,
  denyBlockedAction,
  editMessage,
  getConversation,
  listBlockedActions,
  listConversations,
  postMessage,
  retryMessage,
  stopMessages,
  StopKindWire,
} from './routes.ts';

/** Whether the contract's body schema takes `value`. */
function accepts(body: z.ZodType | undefined): (value: unknown) => boolean {
  assert.ok(body);
  return (value) => body.safeParse(value).success;
}

const postBody = () => ({
  userMessageId: randomUUID(),
  agentMessageId: randomUUID(),
  agentId: 'a1',
  text: 'hello',
});

void test('G5: every route with a conversation id checks that conversation first', () => {
  for (const route of Object.values(chatRoutes)) {
    if (!route.path.includes(':conv')) continue;
    assert.deepEqual(route.check, {
      kind: CheckKind.enum.object,
      type: CONVERSATION_OBJECT,
      idParams: ['org', 'conv'],
      action: route.method === Method.enum.GET ? 'can_read' : 'can_post',
    });
  }
  assert.deepEqual(listConversations.check, { kind: CheckKind.enum.store });
  assert.deepEqual(getConversation.check, {
    kind: CheckKind.enum.object,
    type: CONVERSATION_OBJECT,
    idParams: ['org', 'conv'],
    action: 'can_read',
  });
});

void test('G5: the post body names no thread, and every body is strict', () => {
  const post = accepts(postMessage.body);
  assert.equal(post(postBody()), true);
  assert.equal(post({ ...postBody(), requestContext: { k: 1 } }), true);
  assert.equal(post({ ...postBody(), threadId: randomUUID() }), false);
  assert.equal(post({ ...postBody(), maxSteps: 1 }), false);
  assert.equal(post({ ...postBody(), text: '' }), false);
  const withoutAgent = Object.entries(postBody()).filter(
    ([field]) => field !== 'agentId',
  );
  assert.equal(post(Object.fromEntries(withoutAgent)), false);

  const edit = accepts(editMessage.body);
  assert.equal(edit({ text: 'x' }), true);
  assert.equal(edit({ text: 'x', id: 'm' }), false);
  const retry = accepts(retryMessage.body);
  assert.equal(retry({ idempotencyKey: 'k' }), true);
  assert.equal(retry({ idempotencyKey: '' }), false);
  assert.equal(retry({ idempotencyKey: 'k', extra: 1 }), false);
});

void test('P15: blocked-action routes use conversation checks from routes.md:159-161', () => {
  assert.deepEqual(listBlockedActions.check, {
    kind: CheckKind.enum.object,
    type: CONVERSATION_OBJECT,
    idParams: ['org', 'conv'],
    action: 'can_read',
  });
  for (const route of [approveBlockedAction, denyBlockedAction]) {
    assert.deepEqual(route.check, {
      kind: CheckKind.enum.object,
      type: CONVERSATION_OBJECT,
      idParams: ['org', 'conv'],
      action: 'can_post',
    });
    assert.ok(route.path.includes('/actions/:action/'));
  }
  const approve = accepts(approveBlockedAction.body);
  assert.equal(approve({ remember: true }), true);
  assert.equal(approve({}), true);
  assert.equal(approve({ remember: true, extra: 1 }), false);
  assert.equal('body' in denyBlockedAction, false);
});

void test('C12: a stop names at least one message and a kind the runtime has', () => {
  const stop = accepts(stopMessages.body);
  assert.equal(stop({ messageIds: ['m'], kind: 'cancel' }), true);
  assert.equal(stop({ messageIds: [], kind: 'cancel' }), false);
  assert.equal(stop({ messageIds: ['m'], kind: 'graceful' }), true);
  assert.equal(stop({ messageIds: ['m'], kind: 'later' }), false);
  assert.deepEqual(
    [...StopKindWire.options].sort(),
    [...Object.values(StopKind), 'graceful'].sort(),
  );
});
