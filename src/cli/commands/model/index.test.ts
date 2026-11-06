import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../../../index.ts';
import { runCli } from '../../index.ts';
import { EXIT_OK, EXIT_USAGE } from '../../utils/constants.ts';
import { CliUsage } from '../../utils/failure.ts';
import { scriptedPrompter } from '../../utils/prompts.test-support.ts';
import { harness } from '../grant/grant.test-support.ts';
import type { Reply, Sent } from '../grant/grant.test-support.ts';
import { ModelCommand, ModelText, runModelEnable } from './index.ts';

const Case = z.enum({
  modelsPath: '/api/v1/orgs/acme/models',
  put: 'PUT',
  provider: 'p',
  a: 'a',
  b: 'b',
  on: 'on',
  ghost: 'ghost',
  refA: 'p/a',
  refB: 'p/b',
  refOn: 'p/on',
  providerFlag: '--provider',
  modelFlag: '--model',
  modelsFlag: '--models',
  modelsList: 'a,b',
});

const MODELS = {
  items: [
    {
      provider: Case.enum.provider,
      model: Case.enum.a,
      enabled: false,
      degraded: false,
    },
    {
      provider: Case.enum.provider,
      model: Case.enum.b,
      enabled: false,
      degraded: true,
    },
    {
      provider: Case.enum.provider,
      model: Case.enum.on,
      enabled: true,
      degraded: false,
    },
  ],
};

function reply(sent: Sent): Reply {
  if (sent.path === Case.enum.modelsPath) return { json: MODELS };
  return {
    json: {
      provider: Case.enum.provider,
      model: Case.enum.a,
      enabled: true,
      degraded: false,
    },
  };
}

function policyWrites(sent: readonly Sent[]): Sent[] {
  return sent.filter((s) => s.method === Case.enum.put);
}

const ENABLE = { enabled: true, degraded: false };

void test('V28: the multiselect offers only disabled models and enables each pick once', async (t) => {
  let offered: readonly string[] = [];
  const scripted = scriptedPrompter({
    [ModelText.enum.modelFlag]: [[Case.enum.refA, Case.enum.refB]],
  });
  const h = await harness(t, {
    reply,
    prompter: {
      ...scripted,
      multiselect: (q) => {
        offered = q.options.map((o) => o.value);
        return scripted.multiselect(q);
      },
    },
  });
  assert.equal(await runModelEnable(h.ctx, {}), EXIT_OK);
  assert.ok(!offered.includes(Case.enum.refOn));
  assert.deepEqual(offered, [Case.enum.refA, Case.enum.refB]);
  const writes = policyWrites(h.sent);
  assert.deepEqual(
    writes.map((w) => w.path),
    [
      `${Case.enum.modelsPath}/${Case.enum.refA}`,
      `${Case.enum.modelsPath}/${Case.enum.refB}`,
    ],
  );
  for (const write of writes) assert.deepEqual(write.body, ENABLE);
});

void test('V28: no TTY with --provider and repeated --model, or --models a,b, enables each one', async (t) => {
  for (const flags of [
    [Case.enum.modelFlag, Case.enum.a, Case.enum.modelFlag, Case.enum.b],
    [Case.enum.modelsFlag, Case.enum.modelsList],
  ]) {
    const h = await harness(t, { reply, tty: false });
    const code = await runCli(
      [
        ModelCommand.enum.model,
        ModelCommand.enum.enable,
        Case.enum.providerFlag,
        Case.enum.provider,
        ...flags,
      ],
      h.env,
    );
    assert.equal(code, EXIT_OK);
    const writes = policyWrites(h.sent);
    assert.equal(writes.length, 2);
    for (const write of writes) assert.deepEqual(write.body, ENABLE);
  }
});

void test('V28: no TTY with no --model says missing --model and sends nothing', async (t) => {
  const h = await harness(t, { reply, tty: false });
  await assert.rejects(
    runModelEnable(h.ctx, { provider: Case.enum.provider }),
    (cause) => cause instanceof CliUsage && cause.message === 'missing --model',
  );
  assert.equal(h.sent.length, 0);
  assert.equal(
    await runCli([ModelCommand.enum.model, ModelCommand.enum.enable], h.env),
    EXIT_USAGE,
  );
  assert.equal(h.sent.length, 0);
});

void test('V28: an id not in the list is refused with no policy write', async (t) => {
  const h = await harness(t, { reply, tty: false });
  await assert.rejects(
    runModelEnable(h.ctx, {
      provider: Case.enum.provider,
      model: [Case.enum.a, Case.enum.ghost],
    }),
    CliUsage,
  );
  assert.equal(policyWrites(h.sent).length, 0);
});
