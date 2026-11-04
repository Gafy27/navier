// Fake ACP harness that edits the status file like an agent would.
// FAKE_LOG: file it appends start/end lines to. FAKE_ACTIONS: JSON {"<n>": "done"|"stopped"|"hang"}.
// FAKE_DEFAULT: action for tickets not in FAKE_ACTIONS (default "done").
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parse, stringify } from 'yaml';

const log = process.env.FAKE_LOG ?? '';
const actions = JSON.parse(process.env.FAKE_ACTIONS ?? '{}') as Record<string, string>;
const entry = (ev: string, extra: object = {}): void =>
  appendFileSync(log, `${JSON.stringify({ ev, pid: process.pid, t: Date.now(), ...extra })}\n`);
entry('start');
process.on('exit', () => entry('end'));
process.on('SIGTERM', () => process.exit(0));

const send = (msg: object): void => void process.stdout.write(`${JSON.stringify(msg)}\n`);

function act(prompt: string): string {
  const m = /Status file: (.+?)\. This is anexo (\S+), ticket (\d+)\./.exec(prompt);
  if (m === null) return 'none';
  const [, path, anexo, n] = m;
  const action = actions[n] ?? process.env.FAKE_DEFAULT ?? 'done';
  entry('prompt', { n: Number(n), action });
  if (action === 'hang' || action === 'none') return action;
  const file = parse(readFileSync(path, 'utf8')) as { tickets: { anexo: string; n: number; status: string; reason?: string }[] };
  const row = file.tickets.find((r) => r.anexo === anexo && r.n === Number(n));
  if (row !== undefined) {
    row.status = action;
    if (action === 'stopped') row.reason = 'agent says stop';
  }
  writeFileSync(path, stringify(file));
  return action;
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line) as { id?: number; method?: string; params?: { prompt: { text: string }[] } };
  if (msg.id === undefined) return;
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
  } else if (msg.method === 'session/new') {
    send({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 's1' } });
  } else if (msg.method === 'session/prompt') {
    if (act(msg.params?.prompt[0].text ?? '') === 'hang') return;
    send({ jsonrpc: '2.0', id: msg.id, result: { stopReason: 'end_turn' } });
  }
});
