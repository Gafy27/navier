import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usageMissingFlag } from './copy.ts';
import { CliUsage } from './failure.ts';
import { noTtyPrompter } from './prompts.ts';
import { scriptedPrompter } from './prompts.test-support.ts';

const OPTIONS = [{ value: 'a', label: 'A' }] as const;

void test('V7: every no-TTY method rejects with CliUsage naming the flag', async () => {
  const prompter = noTtyPrompter();
  const q = { message: 'Org?', flag: 'org' };
  const asked = [
    prompter.text(q),
    prompter.password(q),
    prompter.select({ ...q, options: OPTIONS }),
    prompter.multiselect({ ...q, options: OPTIONS }),
    prompter.confirm(q),
  ];
  for (const ask of asked) {
    await assert.rejects(ask, (cause: unknown) => {
      assert.ok(cause instanceof CliUsage);
      assert.equal(cause.message, usageMissingFlag('org'));
      return true;
    });
  }
});

void test('V7: the scripted fake answers by flag in order', async () => {
  const prompter = scriptedPrompter({
    org: ['one', 'two'],
    pick: ['a'],
    many: [['a']],
    ok: [true],
  });
  const q = { message: '?', flag: 'org' };
  assert.equal(await prompter.text(q), 'one');
  assert.equal(await prompter.password(q), 'two');
  const choice = { message: '?', options: OPTIONS };
  assert.equal(await prompter.select({ ...choice, flag: 'pick' }), 'a');
  assert.deepEqual(await prompter.multiselect({ ...choice, flag: 'many' }), [
    'a',
  ]);
  assert.equal(await prompter.confirm({ message: '?', flag: 'ok' }), true);
});

void test('V7: the scripted fake fails on a flag it has no answer for', () => {
  const prompter = scriptedPrompter({ org: ['one'] });
  assert.throws(() => prompter.text({ message: '?', flag: 'space' }));
  void prompter.text({ message: '?', flag: 'org' });
  assert.throws(() => prompter.text({ message: '?', flag: 'org' }));
});
