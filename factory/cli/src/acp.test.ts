import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runTurn } from './acp.ts';
import type { Outcome } from './acp.ts';
import { resolveConfig } from './config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const realKit = join(here, '..', '..');
const fake = join(here, 'fixtures', 'fake_harness.ts');

type Harness = { argv?: string[]; model?: string };

function makeKit(roleModel: string | undefined): string {
  const kit = mkdtempSync(join(tmpdir(), 'kit-'));
  mkdirSync(join(kit, 'agents', 'implementer'), { recursive: true });
  const yaml = roleModel === undefined ? 'name: implementer\n' : `model: ${roleModel}\n`;
  writeFileSync(join(kit, 'agents', 'implementer', 'agent.yaml'), yaml);
  return kit;
}

function makeConfig(mode: string, out: string, h: Harness = {}, name = 'fakeh'): object {
  const entry = {
    argv: h.argv ?? [process.execPath, fake, '--model', '{model}'],
    env: { FAKE_OUT: out, FAKE_MODE: mode, FAKE_MODEL: '{model}' },
    ...(h.model === undefined ? {} : { model: h.model }),
  };
  return {
    cli: { agent: 'implementer', harness: name, turn_timeout_minutes: 1, harnesses: { fakeh: entry } },
  };
}

type Run = { outcome: Outcome; rec: Record<string, unknown> };

async function turn(
  mode: string,
  opts: { h?: Harness; roleModel?: string; timeoutMs?: number; n?: number; fence?: string } = {},
): Promise<Run> {
  const dir = mkdtempSync(join(tmpdir(), 'run-'));
  const out = join(dir, 'rec.json');
  const kit = makeKit(opts.roleModel ?? 'role-model');
  const res = resolveConfig(makeConfig(mode, out, opts.h), kit);
  assert.ok(res.ok);
  const resolved = { ...res.value, timeoutMs: opts.timeoutMs ?? res.value.timeoutMs };
  const outcome = await runTurn({
    resolved,
    kit: realKit,
    cwd: dir,
    fence: opts.fence ?? 'do ticket',
    statusPath: join(dir, 'status.yaml'),
    anexo: 'X_TICKETS.md',
    n: opts.n ?? 1,
  });
  return { outcome, rec: JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown> };
}

test('V7 bad configs return config without spawning; valid config spawns', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'v7-'));
  const out = join(dir, 'rec.json');
  const noModel = resolveConfig(makeConfig('ok', out), makeKit(undefined));
  const badName = resolveConfig(makeConfig('ok', out, {}, 'nope'), makeKit('m'));
  const badPath = resolveConfig(makeConfig('ok', out, { argv: ['no-such-binary-xyz'] }), makeKit('m'));
  for (const r of [noModel, badName, badPath]) {
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.reason, 'config');
  }
  const { outcome } = await turn('ok');
  assert.equal(outcome.kind, 'returned');
});

test('V8 {model} is substituted in argv and env; the harness model wins', async () => {
  const a = await turn('ok', { roleModel: 'role-model' });
  assert.deepEqual(a.rec.argv, ['--model', 'role-model']);
  assert.equal(a.rec.model_env, 'role-model');
  const b = await turn('ok', { roleModel: 'role-model', h: { model: 'harness-model' } });
  assert.equal((b.rec.argv as string[])[1], 'harness-model');
  assert.equal(b.rec.model_env, 'harness-model');
});

test('V9 the prompt is fence 2, a blank line, and the trailer', async () => {
  const { rec } = await turn('ok', { n: 2, fence: 'fence two text' });
  const prompt = rec.prompt as string;
  const [fence, blank, trailer, ...rest] = prompt.split('\n');
  assert.equal(fence, 'fence two text');
  assert.equal(blank, '');
  assert.equal(rest.length, 0);
  assert.match(trailer, /status\.yaml/);
  assert.match(trailer, /X_TICKETS\.md/);
  assert.match(trailer, /ticket 2/);
  assert.doesNotMatch(prompt, /fence one/);
});

test('V10 permissions go through guard.py', async () => {
  const { outcome, rec } = await turn('perms');
  assert.equal(outcome.kind, 'returned');
  assert.deepEqual(rec.answers, ['allow', 'reject', 'reject', 'allow', 'reject']);
});

test('V10b a command sent only on the earlier tool_call update still goes through guard.py', async () => {
  const { outcome, rec } = await turn('cursor');
  assert.equal(outcome.kind, 'returned');
  assert.deepEqual(rec.answers, ['allow']);
});

test('V11a a harness that exits mid-turn is a harness exit with code and stderr', async () => {
  const { outcome } = await turn('exit3');
  assert.equal(outcome.kind, 'harness exit');
  assert.match(outcome.reason, /code 3/);
  assert.match(outcome.reason, /boom from fake/);
});

test('V11b a silent harness times out and its process is gone', async () => {
  const { outcome, rec } = await turn('hang', { timeoutMs: 200 });
  assert.equal(outcome.kind, 'timeout');
  assert.throws(() => process.kill(rec.pid as number, 0));
});

test('V12 cursor/ask_question is answered cancelled and ends the turn as question', async () => {
  const { outcome, rec } = await turn('ask');
  assert.equal(outcome.kind, 'question');
  assert.deepEqual(rec.ask_reply, { outcome: { outcome: 'cancelled' } });
});

test('the client advertises no fs and no terminal capability', async () => {
  const { rec } = await turn('ok');
  const caps = (rec.init as { clientCapabilities: { fs: object; terminal: boolean } }).clientCapabilities;
  assert.equal(caps.terminal, false);
  assert.deepEqual(caps.fs, { readTextFile: false, writeTextFile: false });
});
