import type { createClient } from '../../client/index.ts';
import type { ClientResult, StreamEvent } from '../../client/index.ts';
import type { LoginDeps } from '../commands/auth/login.ts';
import type { ServiceTokens } from '../commands/auth/service-token.ts';
import type { CredentialsStore } from './credentials.ts';
import type { Prompter } from './prompts.ts';

// The shared types live here, not in `index.ts`: a command folder imports them,
// and `index.ts` imports every command folder, so `index.ts` would close a cycle.

export interface Io {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly stdin: () => Promise<string>;
  readonly isTTY: boolean;
}

/** One spawned process (PD9). The supervisor and `db` read it; `src/cli.ts` wraps `node:child_process`. */
export interface Child {
  readonly exited: Promise<number>;
  readonly kill: (signal: 'SIGTERM' | 'SIGKILL') => void;
  readonly lines: AsyncIterable<string>;
}

export type Spawn = (
  command: string,
  args: readonly string[],
  opts: { readonly env: Record<string, string>; readonly cwd: string },
) => Child;

export interface CliEnv {
  /** `$XDG_CONFIG_HOME/mastra-agents`; holds `credentials.json` (PD4). */
  readonly configDir: string;
  /** Holds `config.yaml` and `.secrets/` (PD5). */
  readonly projectDir: string;
  /** `MASTRA_AGENTS_*` variables only (D3). */
  readonly vars: Readonly<Record<string, string | undefined>>;
  /** Loopback bind address for browser login (D1); from `MASTRA_AGENTS_LOOPBACK_HOST`. */
  readonly loopbackHost: string;
  readonly fetch: typeof fetch;
  readonly io: Io;
  readonly prompter: Prompter;
  readonly open: LoginDeps['open'];
  readonly listen: LoginDeps['listen'];
  readonly spawn: Spawn;
  readonly readFile: (path: string) => Promise<string>;
}

export type Client = ReturnType<typeof createClient>;

/** Built once per run; each `register*` gets it. */
export interface CliContext {
  readonly env: CliEnv;
  readonly credentials: CredentialsStore;
  readonly tokens: ServiceTokens;
  /** One client per run, from `credentials.json`. Fails with `run cli login` when the file is missing. */
  readonly client: () => Promise<Client>;
  /** Runs one operation; on `unauthenticated` with a TTY, logs in once and retries (PD11). */
  readonly call: (
    operationId: string,
    input: Record<string, unknown>,
  ) => Promise<ClientResult<unknown>>;
  /** Stream operation; PD11 retry only on an `unauthenticated` first frame. */
  readonly streamCall: (
    operationId: string,
    input: Record<string, unknown>,
  ) => Promise<AsyncIterable<StreamEvent>>;
}
