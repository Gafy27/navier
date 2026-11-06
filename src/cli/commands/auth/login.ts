import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createClient, loginUrl } from '../../../client/index.ts';
import type { CredentialsStore } from '../../utils/credentials.ts';
import { CliFailure } from '../../utils/failure.ts';

const CALLBACK_PATH = '/callback';
const HANDOFF_PARAM = 'handoff';
const DONE_TEXT = 'You can close this tab.';

export interface Listener {
  readonly port: number;
  readonly close: () => Promise<void>;
}

export interface LoginDeps {
  /** Real: spawn the platform opener with an args array, no shell (`src/cli.ts`). */
  readonly open: (url: string) => void;
  readonly fetch: typeof fetch;
  /** 32 bytes for the verifier. */
  readonly random: () => Uint8Array;
  /** Real: `createLoopbackListener()`. Tests pass a fake that records `onRequest`. */
  readonly listen: (onRequest: (url: URL) => void) => Promise<Listener>;
  /** Cancels a login that the browser never completes. */
  readonly signal?: AbortSignal;
}

/** The real deps from a `CliEnv`'s open, fetch, and listen seams. */
export function loginDeps(
  env: Omit<LoginDeps, 'random' | 'signal'>,
): LoginDeps {
  return {
    open: env.open,
    fetch: env.fetch,
    listen: env.listen,
    random: () => randomBytes(32),
  };
}

function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** GET /auth/login → the Auth0 (IdP) authorize URL opened in the browser. */
async function authorizeUrlToOpen(
  fetchFn: typeof fetch,
  loginStart: string,
  loginHint?: string,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetchFn(loginStart, {
      redirect: 'manual',
      ...(signal === undefined ? {} : { signal }),
    });
  } catch {
    const origin = new URL(loginStart).origin;
    throw new CliFailure(`login failed: cannot reach ${origin}`);
  }
  if (res.status < 300 || res.status >= 400) {
    throw new CliFailure(`login failed: unexpected ${String(res.status)}`);
  }
  const location = res.headers.get('location');
  if (location === null || location === '') {
    throw new CliFailure('login redirect had no location');
  }
  const auth = new URL(location, loginStart);
  if (loginHint !== undefined) {
    auth.searchParams.set('login_hint', loginHint);
  }
  return auth.href;
}

/** Rejects when `signal` aborts first; the work itself is not cancelled here. */
function untilAborted<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return work;
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      reject(new CliFailure('login was cancelled'));
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

/**
 * The CLI loopback login (D1). The verifier never leaves this process except
 * in the redeem body. The session id is stored and never printed.
 */
export async function runLogin(
  deps: LoginDeps,
  credentials: CredentialsStore,
  baseUrl: string,
  loopbackHost: string,
  loginHint?: string,
): Promise<void> {
  const verifier = Buffer.from(deps.random()).toString('base64url');
  let listener: Listener | undefined;
  try {
    let resolveCode: (code: string) => void = () => undefined;
    let rejectCode: (cause: CliFailure) => void = () => undefined;
    const code = new Promise<string>((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    listener = await deps.listen((url) => {
      if (url.pathname !== CALLBACK_PATH) return;
      const value = url.searchParams.get(HANDOFF_PARAM);
      if (value === null || value === '') {
        rejectCode(new CliFailure('login callback had no handoff code'));
        return;
      }
      resolveCode(value);
    });
    const start = loginUrl(baseUrl, {
      return: `http://${loopbackHost}:${String(listener.port)}${CALLBACK_PATH}`,
      handoffChallenge: challengeOf(verifier),
    });
    deps.open(
      await authorizeUrlToOpen(deps.fetch, start, loginHint, deps.signal),
    );
    const handoff = await untilAborted(code, deps.signal);
    const client = createClient({
      baseUrl,
      credential: () => undefined,
      fetch: deps.fetch,
    });
    const result = await client.handoff(
      { body: { handoff, verifier } },
      deps.signal === undefined ? {} : { signal: deps.signal },
    );
    if (!result.ok) {
      throw new CliFailure(`login failed: ${result.error.type}`);
    }
    await credentials.write({
      baseUrl,
      auth: { kind: 'person', session: result.value.session },
    });
  } finally {
    await listener?.close();
  }
}

/** The real loopback listener: one host from env, ephemeral port (D1). */
export function createLoopbackListener(host: string): LoginDeps['listen'] {
  return (onRequest) =>
    new Promise<Listener>((resolve, reject) => {
      const server = createServer((req, res) => {
        onRequest(new URL(req.url ?? '/', `http://${host}`));
        res.writeHead(200, { 'content-type': 'text/plain' }).end(DONE_TEXT);
      });
      server.once('error', reject);
      server.listen(0, host, () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          server.close();
          reject(new CliFailure('loopback listener has no port'));
          return;
        }
        resolve({
          port: address.port,
          close: () =>
            new Promise<void>((done) => {
              server.closeAllConnections();
              server.close(() => {
                done();
              });
            }),
        });
      });
    });
}
