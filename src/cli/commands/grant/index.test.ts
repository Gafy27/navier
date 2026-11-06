import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from '../../../index.ts';
import { runCli } from '../../index.ts';
import { EXIT_OK, EXIT_USAGE } from '../../utils/constants.ts';
import { GrantCommand } from './index.ts';
import { harness } from './grant.test-support.ts';

const Argv = z.enum({
  sub: '--sub',
  tool: '--tool',
  bob: 'bob',
  lookup: 'lookup',
  refund: 'refund',
  list: 'list',
  help: '--help',
  post: 'POST',
});

void test('grant add takes a repeated --tool into one write', async (t) => {
  const h = await harness(t, { reply: () => ({ json: {} }) });
  const code = await runCli(
    [
      GrantCommand.enum.grant,
      GrantCommand.enum.add,
      Argv.enum.sub,
      Argv.enum.bob,
      Argv.enum.tool,
      Argv.enum.lookup,
      Argv.enum.tool,
      Argv.enum.refund,
    ],
    h.env,
  );
  assert.equal(code, EXIT_OK);
  const posts = h.sent.filter((s) => s.method === Argv.enum.post);
  assert.equal(posts.length, 1);
  assert.match(h.out(), /tool refund: assign granted/u);
});

void test('grant remove with no TTY and no --sub exits with usage and sends nothing', async (t) => {
  const h = await harness(t, { reply: () => ({ json: {} }), tty: false });
  const code = await runCli(
    [
      GrantCommand.enum.grant,
      GrantCommand.enum.remove,
      Argv.enum.tool,
      Argv.enum.lookup,
    ],
    h.env,
  );
  assert.equal(code, EXIT_USAGE);
  assert.equal(h.sent.length, 0);
});

void test('grant list stays a table leaf beside add and remove', async (t) => {
  const h = await harness(t, { reply: () => ({ json: {} }) });
  await runCli([GrantCommand.enum.grant, Argv.enum.help], h.env);
  for (const verb of [
    GrantCommand.enum.add,
    GrantCommand.enum.remove,
    Argv.enum.list,
  ]) {
    assert.match(h.out(), new RegExp(`\\b${verb}\\b`, 'u'));
  }
});
