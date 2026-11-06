import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../../../index.ts';
import { WireType } from '../../../client/index.ts';
import { EXIT_OK } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import {
  GrantChange,
  GrantPrivilege,
  runGrantAdd,
  runGrantRemove,
} from './grant.ts';
import { Fake, harness } from './grant.test-support.ts';
import type { Reply, Sent } from './grant.test-support.ts';

const Case = z.enum({
  grantsPath: '/api/v1/orgs/acme/grants',
  post: 'POST',
  sub: 'bob',
  grantee: 'user:ns~bob',
  toolA: 'lookup',
  toolB: 'refund',
  objectA: 'tool:acme~lookup',
  objectB: 'tool:acme~refund',
  badSub: 'a:b',
  badTool: 'a/b',
  denied: 'no grant for you',
  orgFlag: 'org',
});

const ok: Reply = { json: {} };

function grantWrites(sent: readonly Sent[]): Sent[] {
  return sent.filter(
    (s) => s.path === Case.enum.grantsPath && s.method === Case.enum.post,
  );
}

function expectedBody(change: z.infer<typeof GrantChange>): unknown {
  const entry = [
    { principal: Case.enum.grantee, privilege: GrantPrivilege.enum.assign },
  ];
  return {
    objects: [
      { object: Case.enum.objectA, [change]: entry },
      { object: Case.enum.objectB, [change]: entry },
    ],
  };
}

void test('V27: grant add batches every tool in one writeGrants write and prints one line per tool', async (t) => {
  const h = await harness(t, { reply: () => ok });
  const code = await runGrantAdd(h.ctx, {
    sub: Case.enum.sub,
    tools: [Case.enum.toolA, Case.enum.toolB],
  });
  assert.equal(code, EXIT_OK);
  const writes = grantWrites(h.sent);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]?.body, expectedBody(GrantChange.enum.writes));
  assert.equal(
    h.out(),
    `tool ${Case.enum.toolA}: assign granted\ntool ${Case.enum.toolB}: assign granted\n`,
  );
});

void test('V27: grant remove sends the same objects as deletes', async (t) => {
  const h = await harness(t, { reply: () => ok });
  await runGrantRemove(h.ctx, {
    org: Fake.enum.org,
    sub: Case.enum.sub,
    tools: [Case.enum.toolA, Case.enum.toolB],
  });
  const writes = grantWrites(h.sent);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]?.body, expectedBody(GrantChange.enum.deletes));
  assert.match(h.out(), /assign revoked/u);
});

void test('a bad sub is a usage error and writes nothing (P13.8 PD5)', async (t) => {
  const h = await harness(t, { reply: () => ok });
  await assert.rejects(
    runGrantAdd(h.ctx, { sub: Case.enum.badSub, tools: [Case.enum.toolA] }),
    CliUsage,
  );
  assert.equal(grantWrites(h.sent).length, 0);
});

void test('a bad tool key is a usage error before any request', async (t) => {
  const h = await harness(t, { reply: () => ok });
  await assert.rejects(
    runGrantAdd(h.ctx, { sub: Case.enum.sub, tools: [Case.enum.badTool] }),
    CliUsage,
  );
  assert.equal(h.sent.length, 0);
});

void test('a refused write fails with the API type and message', async (t) => {
  const h = await harness(t, {
    reply: () => ({
      status: 403,
      error: { type: WireType.enum.forbidden, message: Case.enum.denied },
    }),
  });
  await assert.rejects(
    runGrantAdd(h.ctx, { sub: Case.enum.sub, tools: [Case.enum.toolA] }),
    (cause) =>
      cause instanceof CliFailure &&
      cause.message === `${WireType.enum.forbidden}: ${Case.enum.denied}`,
  );
  assert.equal(h.out(), '');
});

void test('with no org in context, --org is asked, and no TTY makes it missing --org', async (t) => {
  const asked = await harness(t, {
    reply: () => ok,
    contextOrg: false,
    prompter: scriptedPrompter({ [Case.enum.orgFlag]: [Fake.enum.org] }),
  });
  await runGrantAdd(asked.ctx, {
    sub: Case.enum.sub,
    tools: [Case.enum.toolA],
  });
  assert.equal(grantWrites(asked.sent).length, 1);

  const none = await harness(t, { reply: () => ok, contextOrg: false });
  await assert.rejects(
    runGrantAdd(none.ctx, { sub: Case.enum.sub, tools: [Case.enum.toolA] }),
    (cause) => cause instanceof CliUsage && cause.message === 'missing --org',
  );
  assert.equal(none.sent.length, 0);
});
