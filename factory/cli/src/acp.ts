import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import type { Resolved } from './config.ts';

export type OutcomeKind = 'returned' | 'question' | 'harness exit' | 'timeout' | 'interrupted';
export type Outcome = { kind: OutcomeKind; reason: string };

export type TurnInput = {
  resolved: Resolved;
  kit: string;
  cwd: string;
  fence: string;
  statusPath: string;
  anexo: string;
  n: number;
  signal?: AbortSignal;
};

const GUARD_TIMEOUT_MS = 10_000;
const KILL_GRACE_MS = 5_000;
// Lets the cancelled reply reach the child before it is killed.
const REPLY_GRACE_MS = 100;
const EXIT_WAIT_MS = 200;
const STDERR_LINES = 20;
const QUESTION_METHODS = ['cursor/ask_question', 'cursor/create_plan'];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// D6: the SESSION fence unchanged, a blank line, one trailer line.
export function buildPrompt(i: Pick<TurnInput, 'fence' | 'statusPath' | 'anexo' | 'n'>): string {
  const trailer =
    `Status file: ${i.statusPath}. This is anexo ${i.anexo}, ticket ${i.n}. ` +
    `Before ending the turn, set only that row to done or stopped (with a reason if stopped).`;
  return `${i.fence}\n\n${trailer}`;
}

function runGuard(kit: string, payload: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    const guard = spawn('python3', [join(kit, 'hooks', 'guard.py')], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let out = '';
    const timer = setTimeout(() => guard.kill('SIGKILL'), GUARD_TIMEOUT_MS);
    guard.stdout.on('data', (d: Buffer) => (out += d.toString()));
    guard.stdin.on('error', () => {});
    guard.on('error', () => resolve(false));
    guard.on('close', () => {
      clearTimeout(timer);
      try {
        const reply: unknown = JSON.parse(out);
        const permission = (reply as { permission?: unknown } | null)?.permission;
        resolve(permission === 'allow');
      } catch {
        resolve(false);
      }
    });
    guard.stdin.end(JSON.stringify(payload));
  });
}

function hasCommand(rawInput: unknown): boolean {
  if (typeof rawInput !== 'object' || rawInput === null) return false;
  const r = rawInput as Record<string, unknown>;
  const cmd = r.command ?? r.cmd;
  return typeof cmd === 'string' && cmd.trim() !== '';
}

function pick(options: acp.PermissionOption[], allow: boolean): acp.RequestPermissionResponse {
  const want = allow ? 'allow_once' : 'reject_once';
  const found = options.find((o) => o.kind === want) ?? options.find((o) => o.kind === 'reject_once');
  if (found === undefined) return { outcome: { outcome: 'cancelled' } };
  return { outcome: { outcome: 'selected', optionId: found.optionId } };
}

async function answerPermission(
  kit: string,
  req: acp.RequestPermissionRequest,
  seen: Map<string, unknown>,
): Promise<acp.RequestPermissionResponse> {
  // Cursor sends rawInput on the earlier tool_call update, not on the request.
  const toolCall = { ...req.toolCall, rawInput: req.toolCall.rawInput ?? seen.get(req.toolCall.toolCallId) };
  if (toolCall.kind === 'execute' && !hasCommand(toolCall.rawInput)) {
    return pick(req.options, false);
  }
  const payload = {
    hook_event_name: 'factory-cli',
    tool_input: toolCall.rawInput,
    tool_call: toolCall,
  };
  return pick(req.options, await runGuard(kit, payload));
}

export async function runTurn(input: TurnInput): Promise<Outcome> {
  const [cmd, ...args] = input.resolved.argv;
  const child = spawn(cmd, args, {
    cwd: input.cwd,
    env: { ...process.env, ...input.resolved.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.on('error', () => {});

  let stderr = '';
  child.stderr.on('data', (d: Buffer) => {
    stderr = stderr.concat(d.toString()).split('\n').slice(-STDERR_LINES - 1).join('\n');
  });
  const exited = new Promise<void>((r) => child.once('close', () => r()));

  let decide: (o: Outcome) => void = () => {};
  const first = new Promise<Outcome>((r) => (decide = r));
  const exitOutcome = (what: string): Outcome => ({
    kind: 'harness exit',
    reason: `harness exit (${what}): ${stderr.trim().split('\n').slice(-STDERR_LINES).join('\n')}`,
  });
  child.once('error', (e) => decide(exitOutcome(e.message)));
  child.once('close', (code, sig) => decide(exitOutcome(`code ${code ?? sig}`)));

  const timer = setTimeout(
    () => decide({ kind: 'timeout', reason: 'timeout' }),
    input.resolved.timeoutMs,
  );
  const onAbort = (): void => decide({ kind: 'interrupted', reason: 'interrupted' });
  if (input.signal?.aborted) onAbort();
  input.signal?.addEventListener('abort', onAbort);

  const seen = new Map<string, unknown>();
  const client: acp.Client = {
    requestPermission: (req) => answerPermission(input.kit, req, seen),
    sessionUpdate: async ({ update }) => {
      if ((update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') && update.rawInput !== undefined) {
        seen.set(update.toolCallId, update.rawInput);
      }
    },
    extMethod: async (method) => {
      if (!QUESTION_METHODS.includes(method)) throw acp.RequestError.methodNotFound(method);
      decide({ kind: 'question', reason: 'question' });
      return { outcome: { outcome: 'cancelled' } };
    },
  };
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  );
  const conn = new acp.ClientSideConnection(() => client, stream);

  let sessionId: string | undefined;
  void (async () => {
    await conn.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    });
    ({ sessionId } = await conn.newSession({ cwd: input.cwd, mcpServers: [] }));
    await conn.prompt({ sessionId, prompt: [{ type: 'text', text: buildPrompt(input) }] });
    decide({ kind: 'returned', reason: '' });
  })().catch(async (e: unknown) => {
    // A dying child closes the connection first; give its exit status a moment to arrive.
    await Promise.race([exited, sleep(EXIT_WAIT_MS)]);
    const code = child.exitCode ?? child.signalCode;
    decide(exitOutcome(code === null ? `acp error: ${String(e)}` : `code ${code}`));
  });

  const outcome = await first;
  clearTimeout(timer);
  input.signal?.removeEventListener('abort', onAbort);
  if (sessionId !== undefined && (outcome.kind === 'timeout' || outcome.kind === 'interrupted')) {
    conn.cancel({ sessionId }).catch(() => {});
  }
  if (outcome.kind === 'question') await sleep(REPLY_GRACE_MS);
  await stop(child, exited);
  return outcome;
}

async function stop(child: ChildProcess, exited: Promise<void>): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const killer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS);
  await exited;
  clearTimeout(killer);
}
