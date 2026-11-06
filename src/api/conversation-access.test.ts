import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createLogger, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { createDb, parseOrgId } from '../db/index.ts';
import {
  DenyReason,
  parsePrincipalId,
  PrincipalKind,
} from '../identity/index.ts';
import type { AuthzAdmin, Caller, Decision } from '../identity/index.ts';
import {
  ConversationAction,
  listReadable,
  requireConversation,
} from './conversation-access.ts';
import { testCaller } from '../../test/support/caller.ts';

function unwrap<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error('unexpected err');
  return r.value;
}

const org = unwrap(parseOrgId('A'));
const caller: Caller = (() => {
  const id = unwrap(parsePrincipalId('user:ns~pat'));
  return testCaller({ kind: PrincipalKind.person, id }, `tok.${id}`);
})();

type Checked = Parameters<AuthzAdmin['checkObjects']>[2];

/** Answers each `checkObjects` call with the next scripted decisions, and records the items asked. */
function scriptedAdmin(...answers: Decision[][]): {
  admin: Pick<AuthzAdmin, 'checkObjects'>;
  asked: Checked[];
} {
  const asked: Checked[] = [];
  return {
    asked,
    admin: {
      checkObjects: (_caller, _org, items) => {
        asked.push(items);
        return Promise.resolve(ok(answers.shift() ?? []));
      },
    },
  };
}

const allow: Decision = { allow: true };
const deny = (reason: DenyReason): Decision => ({ allow: false, reason });

const failure = (r: Result<unknown>) =>
  r.ok ? undefined : { code: r.error.code, message: r.error.message };

void test('V11: allow is ok; a hidden conversation reads as a missing one; no grant is permission_denied', async () => {
  const { admin, asked } = scriptedAdmin(
    [allow],
    [deny(DenyReason.not_visible)],
    [deny(DenyReason.no_grant)],
    [deny(DenyReason.not_visible)],
    [deny(DenyReason.unavailable)],
  );
  const check = (threadId: string) =>
    requireConversation(
      admin,
      caller,
      org,
      threadId,
      ConversationAction.enum.can_post,
    );

  assert.equal((await check('t1')).ok, true);
  const hidden = await check('t1');
  assert.deepEqual(failure(hidden), {
    code: 'not_found',
    message: 'not found',
  });
  assert.deepEqual(failure(await check('t1')), {
    code: 'permission_denied',
    message: 'forbidden',
  });
  assert.deepEqual(failure(await check(randomUUID())), failure(hidden));
  assert.equal(failure(await check('t1'))?.code, 'unavailable');

  const [first] = asked;
  assert.deepEqual(first, [
    {
      object: { type: 'conversation', id: 'A~t1' },
      action: ConversationAction.enum.can_post,
    },
  ]);
});

void test('requireConversation passes an unanswered check through', async () => {
  const unanswered = await requireConversation(
    {
      checkObjects: () =>
        Promise.resolve({
          ok: false as const,
          error: { code: 'unavailable', message: 'authz-api unavailable' },
        }),
    },
    caller,
    org,
    't1',
    ConversationAction.enum.can_read,
  );
  assert.equal(failure(unanswered)?.code, 'unavailable');
});

void test('V12: listReadable refuses a limit that is not an integer of at least 1, before any read', async () => {
  const { admin, asked } = scriptedAdmin();
  const { db, close } = createDb(
    { DATABASE_URL: 'postgres://unused.invalid/none', DATABASE_POOL_MAX: 1 },
    createLogger('silent'),
  );
  try {
    for (const limit of [0, 1.5, -1]) {
      const refused = await listReadable(admin, db, caller, org, { limit });
      assert.equal(failure(refused)?.code, 'invalid_argument');
    }
    assert.deepEqual(asked, []);
  } finally {
    await close();
  }
});
