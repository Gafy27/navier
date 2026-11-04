// Fake ACP harness. FAKE_OUT is a JSON file it records into; FAKE_MODE picks the behavior.
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const out = process.env.FAKE_OUT ?? '';
const mode = process.env.FAKE_MODE ?? 'ok';
const record: Record<string, unknown> = {
  argv: process.argv.slice(2),
  model_env: process.env.FAKE_MODEL ?? null,
  pid: process.pid,
  answers: [],
};
const save = (): void => writeFileSync(out, JSON.stringify(record));
save();

const send = (msg: object): void => void process.stdout.write(`${JSON.stringify(msg)}\n`);
let nextId = 1000;
const waiting = new Map<number, (result: unknown) => void>();
const call = (method: string, params: object): Promise<unknown> =>
  new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    send({ jsonrpc: '2.0', id, method, params });
  });

const options = [
  { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
  { optionId: 'reject', name: 'Reject', kind: 'reject_once' },
];
const perm = (toolCall: object): Promise<unknown> =>
  call('session/request_permission', { sessionId: 's1', toolCall: { toolCallId: 't', ...toolCall }, options });

async function onPrompt(id: number, params: { prompt: { text: string }[] }): Promise<void> {
  record.prompt = params.prompt[0].text;
  save();
  if (mode === 'exit3') {
    process.stderr.write('boom from fake\n');
    process.exit(3);
  }
  if (mode === 'hang') return;
  if (mode === 'ask') {
    record.ask_reply = await call('cursor/ask_question', { question: 'which?' });
    save();
    return;
  }
  if (mode === 'cursor') {
    // Like Cursor: the command is on the earlier tool_call update, not on the request.
    send({
      jsonrpc: '2.0',
      method: 'session/update',
      params: { sessionId: 's1', update: { sessionUpdate: 'tool_call', toolCallId: 't', title: 'git status', kind: 'execute', rawInput: { command: 'git status' } } },
    });
    const reply = (await perm({ kind: 'execute' })) as { outcome: { optionId?: string; outcome: string } };
    (record.answers as unknown[]).push(reply.outcome.optionId ?? reply.outcome.outcome);
    save();
  }
  if (mode === 'perms') {
    const requests = [
      { kind: 'execute', rawInput: { command: 'git status' } },
      { kind: 'execute', rawInput: { command: 'git push' } },
      { kind: 'execute', rawInput: {} },
      { kind: 'edit', locations: [{ path: 'src/a.c' }] },
      { kind: 'edit', locations: [{ path: '.env' }] },
    ];
    for (const r of requests) {
      const reply = (await perm(r)) as { outcome: { optionId?: string; outcome: string } };
      (record.answers as unknown[]).push(reply.outcome.optionId ?? reply.outcome.outcome);
      save();
    }
  }
  send({ jsonrpc: '2.0', id, result: { stopReason: 'end_turn' } });
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line) as { id?: number; method?: string; params?: never; result?: unknown };
  if (msg.method === undefined && msg.id !== undefined) {
    waiting.get(msg.id)?.(msg.result);
    return;
  }
  if (msg.id === undefined) return;
  if (msg.method === 'initialize') {
    record.init = msg.params;
    save();
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: 1, agentCapabilities: {} } });
  } else if (msg.method === 'session/new') {
    send({ jsonrpc: '2.0', id: msg.id, result: { sessionId: 's1' } });
  } else if (msg.method === 'session/prompt') {
    void onPrompt(msg.id, msg.params as never);
  }
});
