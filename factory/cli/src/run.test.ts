import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, 'cli.ts');
const fake = join(here, 'fixtures', 'fake_runner.ts');
const ANEXO = 'A_TICKETS.md';

type Row = { anexo: string; n: number; status: string; reason?: string };
type Env = { dir: string; phase: string; status: string; lock: string; log: string; env: NodeJS.ProcessEnv };

function setup(sessions: number, actions: Record<string, string> = {}, fallback = 'done'): Env {
  const dir = mkdtempSync(join(tmpdir(), 'run-'));
  const designs = join(dir, 'designs');
  const phase = join(designs, 'phase');
  mkdirSync(phase, { recursive: true });
  const md = Array.from({ length: sessions }, (_, i) => `## SESSION ${i + 1}\n\n\`\`\`\nprompt ${i + 1}\n\`\`\`\n`);
  writeFileSync(join(phase, ANEXO), md.join('\n'));
  const log = join(dir, 'fake.log');
  const config = {
    paths: { designs, runs: join(dir, 'runs') },
    cli: {
      agent: 'implementer',
      harness: 'fakeh',
      turn_timeout_minutes: 1,
      harnesses: { fakeh: { argv: [process.execPath, fake], model: 'm' } },
    },
  };
  writeFileSync(join(dir, 'config.yaml'), stringify(config));
  const env = {
    ...process.env,
    FACTORY_CONFIG: join(dir, 'config.yaml'),
    FAKE_LOG: log,
    FAKE_ACTIONS: JSON.stringify(actions),
    FAKE_DEFAULT: fallback,
  };
  return { dir, phase, status: join(dir, 'runs', 'phase', 'status.yaml'), lock: join(dir, 'runs', 'phase', 'run.lock'), log, env };
}

const run = (e: Env, ...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { env: e.env, encoding: 'utf8' });

const rows = (e: Env): Row[] => (parse(readFileSync(e.status, 'utf8')) as { tickets: Row[] }).tickets;

const events = (e: Env): { ev: string; pid: number; t: number }[] =>
  existsSync(e.log)
    ? readFileSync(e.log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

function seedStatus(e: Env, tickets: Row[]): void {
  mkdirSync(dirname(e.status), { recursive: true });
  writeFileSync(e.status, stringify({ phase: 'phase', tickets }));
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test('V13 a stopped row ends the run; the next run resumes there; children never overlap', () => {
  const e = setup(3, { '1': 'done', '2': 'stopped' });
  const first = run(e, 'run', e.phase);
  assert.equal(first.status, 1);
  assert.deepEqual(rows(e).map((r) => r.status), ['done', 'stopped', 'pending']);
  assert.equal(events(e).filter((x) => x.ev === 'start').length, 2);

  e.env.FAKE_ACTIONS = '{}';
  const second = run(e, 'run', e.phase);
  assert.equal(second.status, 0);
  assert.deepEqual(rows(e).map((r) => r.status), ['done', 'done', 'done']);
  const prompts = events(e).filter((x) => x.ev === 'prompt') as unknown as { n: number }[];
  assert.deepEqual(prompts.map((p) => p.n), [1, 2, 2, 3]);

  const all = events(e);
  const spans = all.filter((x) => x.ev === 'start').map((s) => ({
    s: s.t,
    e: all.find((x) => x.ev === 'end' && x.pid === s.pid)?.t ?? Infinity,
  }));
  spans.sort((a, b) => a.s - b.s);
  spans.slice(1).forEach((span, i) => assert.ok(span.s >= spans[i].e, 'children overlapped'));
  assert.equal(existsSync(e.lock), false);
});

test('V14 list skips phases without tickets; run without an argument exits 2', () => {
  const e = setup(1);
  mkdirSync(join(e.dir, 'designs', 'empty'));
  writeFileSync(join(e.dir, 'designs', 'empty', 'README.md'), 'no tickets');
  const list = run(e, 'list');
  assert.equal(list.status, 0);
  assert.deepEqual(list.stdout.trim().split('\n'), [e.phase]);
  const none = run(e, 'run');
  assert.equal(none.status, 2);
  assert.equal(none.stderr.trim().split('\n').length, 1);
});

test('V14b status ends with a done N/M line', () => {
  const e = setup(2);
  seedStatus(e, [
    { anexo: ANEXO, n: 1, status: 'done' },
    { anexo: ANEXO, n: 2, status: 'pending' },
  ]);
  const r = run(e, 'status', e.phase);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().split('\n').at(-1), 'done 1/2');
});

test('V15a a live lock exits 2 without a spawn or a status change', () => {
  const e = setup(1);
  seedStatus(e, [{ anexo: ANEXO, n: 1, status: 'pending' }]);
  writeFileSync(e.lock, String(process.pid));
  const before = readFileSync(e.status, 'utf8');
  const r = run(e, 'run', e.phase);
  assert.equal(r.status, 2);
  assert.equal(readFileSync(e.status, 'utf8'), before);
  assert.equal(events(e).length, 0);
});

test('V15b a dead lock settles the running row as no result and continues', () => {
  const e = setup(2);
  seedStatus(e, [
    { anexo: ANEXO, n: 1, status: 'running' },
    { anexo: ANEXO, n: 2, status: 'pending' },
  ]);
  writeFileSync(e.lock, '2147483646');
  const r = run(e, 'run', e.phase);
  assert.equal(r.status, 1, r.stderr);
  const [one, two] = rows(e);
  assert.equal(one.status, 'stopped');
  assert.equal(one.reason, 'no result');
  assert.equal(two.status, 'done');
});

test('V16 SIGINT stops the row as interrupted, kills the fake, drops the lock, exits 130', async () => {
  const e = setup(1, { '1': 'hang' });
  const child = spawn(process.execPath, [cli, 'run', e.phase], { env: e.env, stdio: 'ignore' });
  const code = new Promise<number | null>((r) => child.once('close', (c) => r(c)));
  for (let i = 0; i < 100 && !events(e).some((x) => x.ev === 'prompt'); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  const pid = events(e)[0].pid;
  assert.ok(events(e).some((x) => x.ev === 'prompt'), 'fake never got the prompt');
  child.kill('SIGINT');
  assert.equal(await code, 130);
  assert.equal(rows(e)[0].status, 'stopped');
  assert.equal(rows(e)[0].reason, 'interrupted');
  assert.equal(alive(pid), false);
  assert.equal(existsSync(e.lock), false);
});
