import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { text } from 'node:stream/consumers';
import { createLoopbackListener } from './cli/commands/auth/login.ts';
import { openerCommand } from './cli/commands/auth/opener.ts';
import { resolveLoopbackHost } from './cli/env-keys.ts';
import { runCli } from './cli/index.ts';
import type { Io, Spawn } from './cli/index.ts';
import { clackPrompter, noTtyPrompter } from './cli/utils/prompts.ts';

const CONFIG_DIR = 'mastra-agents';
const VAR_PREFIX = 'MASTRA_AGENTS_';

const isTTY = process.stdout.isTTY;

const io: Io = {
  stdout: (line) => {
    process.stdout.write(line);
  },
  stderr: (line) => {
    process.stderr.write(line);
  },
  stdin: () => text(process.stdin),
  isTTY,
};

/** No shell: the args are an array, and the child's stdout is the supervisor's line stream. */
const realSpawn: Spawn = (command, args, opts) => {
  const child = spawn(command, [...args], {
    env: opts.env,
    cwd: opts.cwd,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return {
    exited: new Promise<number>((resolve) => {
      child.once('error', () => {
        resolve(1);
      });
      child.once('close', (code) => {
        resolve(code ?? 1);
      });
    }),
    kill: (signal) => {
      child.kill(signal);
    },
    lines: createInterface({ input: child.stdout }),
  };
};

/** The real `open` for `LoginDeps`. A missing opener prints the URL, not a secret (D1). */
function openUrl(url: string): void {
  const { command, args } = openerCommand(process.platform, url);
  const child = spawn(command, [...args], { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    io.stderr(`open this URL in a browser: ${url}\n`);
  });
  child.unref();
}

const configRoot = process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config');

const vars = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.startsWith(VAR_PREFIX)),
);
const loopbackHost = resolveLoopbackHost(vars, '127.0.0.1');

process.exitCode = await runCli(process.argv.slice(2), {
  configDir: join(configRoot, CONFIG_DIR),
  projectDir: process.cwd(),
  vars,
  loopbackHost,
  fetch,
  io,
  prompter: isTTY ? clackPrompter() : noTtyPrompter(),
  open: openUrl,
  listen: createLoopbackListener(loopbackHost),
  spawn: realSpawn,
  readFile: (path) => readFile(path, 'utf8'),
});
