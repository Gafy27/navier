import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildStatus, nextRow, parseStatus, setRow, settle, Status, writeStatus,
} from './status.ts';
import type { StatusFile } from './status.ts';
import { listAnexos, parseAnexo } from './tickets.ts';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), 'factory-cli-'));

const anexo = (name: string, ns: number[]) => ({
  name,
  sessions: ns.map((n) => ({ n, prompt: `p${n}` })),
});

const file = (...rows: [string, number, string, string?][]): StatusFile => ({
  phase: 'p',
  tickets: rows.map(([anexo, n, status, reason]) => ({
    anexo, n, status: status as never, ...(reason === undefined ? {} : { reason }),
  })),
});

test('V1 next row skips done and moves across anexos', () => {
  const s = file(['A', 1, 'pending'], ['A', 2, 'done'], ['B', 1, 'stopped', 'x']);
  assert.deepEqual(nextRow(s), s.tickets[0]);
  const after = setRow(s, { anexo: 'A', n: 1 }, Status.done);
  assert.deepEqual(nextRow(after)?.anexo, 'B');
  assert.equal(nextRow(after)?.n, 1);
});

test('V2 rebuild keeps status and reason, drops gone, adds new', () => {
  const prev = file(['A', 1, 'done'], ['A', 2, 'stopped', 'why'], ['A', 3, 'pending']);
  const next = buildStatus('p', [anexo('A', [1, 2, 4])], prev);
  assert.deepEqual(next.tickets, [
    { anexo: 'A', n: 1, status: 'done' },
    { anexo: 'A', n: 2, status: 'stopped', reason: 'why' },
    { anexo: 'A', n: 4, status: 'pending' },
  ]);
});

test('V3 prompt is the first fence, whole', () => {
  const text = readFileSync(join(here, 'fixtures', 'two_fences_TICKETS.md'), 'utf8');
  const [one, two] = parseAnexo(text);
  assert.equal(one.prompt, 'first prompt line\n\nsecond line');
  assert.equal(
    two.prompt,
    'prompt two before heading\n## A heading inside the fence\nafter heading',
  );
});

test('listAnexos reads *_TICKETS.md in filename order', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'B_TICKETS.md'), '## SESSION 1\n\n```\nb\n```\n');
  writeFileSync(join(dir, 'A_TICKETS.md'), '## SESSION 1\n\n```\na\n```\n');
  writeFileSync(join(dir, 'README.md'), '## SESSION 1\n\n```\nx\n```\n');
  assert.deepEqual(listAnexos(dir).map((a) => [a.name, a.sessions[0].prompt]), [
    ['A_TICKETS.md', 'a'],
    ['B_TICKETS.md', 'b'],
  ]);
});

const key = { anexo: 'A', n: 1 };
const snap = () => file(['A', 1, 'running'], ['A', 2, 'pending']);
const text = (s: StatusFile) => JSON.stringify(s); // JSON is valid YAML

test('V4 settle: done, stopped silent, still running', () => {
  const done = settle(snap(), text(setRow(snap(), key, Status.done)), key, { kind: 'returned' });
  assert.deepEqual(done.tickets[0], { anexo: 'A', n: 1, status: 'done' });
  const stopped = settle(
    snap(), text(setRow(snap(), key, Status.stopped, 'silent')), key, { kind: 'returned' },
  );
  assert.deepEqual(stopped.tickets[0].reason, 'silent');
  assert.equal(stopped.tickets[0].status, 'stopped');
  const running = settle(snap(), text(snap()), key, { kind: 'returned' });
  assert.equal(running.tickets[0].status, 'stopped');
  assert.equal(running.tickets[0].reason, 'no result');
});

test('V5 settle: another row changed is restored', () => {
  const cheat = setRow(setRow(snap(), key, Status.done), { anexo: 'A', n: 2 }, Status.done);
  const out = settle(snap(), text(cheat), key, { kind: 'returned' });
  assert.equal(out.tickets[0].status, 'stopped');
  assert.equal(out.tickets[0].reason, 'other rows');
  assert.equal(out.tickets[1].status, 'pending');
});

test('V6 settle: bad yaml; write is atomic with no temp left', () => {
  const out = settle(snap(), 'a: [unclosed\n  - : :', key, { kind: 'returned' });
  assert.equal(out.tickets[0].reason, 'bad status');
  assert.equal(settle(snap(), '- just\n- a list', key, { kind: 'returned' }).tickets[0].reason, 'bad status');
  assert.equal(settle(snap(), undefined, key, { kind: 'returned' }).tickets[0].reason, 'bad status');
  const dir = tmp();
  const path = join(dir, 'runs', 'p', 'status.yaml');
  writeStatus(path, out);
  assert.deepEqual(parseStatus(readFileSync(path, 'utf8')), out);
  assert.deepEqual(readdirSync(join(dir, 'runs', 'p')), ['status.yaml']);
});

test('settle: early outcome writes its reason and ignores the file', () => {
  const out = settle(snap(), text(setRow(snap(), key, Status.done)), key, {
    kind: 'early', reason: 'timeout',
  });
  assert.equal(out.tickets[0].reason, 'timeout');
  assert.equal(out.tickets[0].status, 'stopped');
});
