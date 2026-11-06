import { z } from '../../../index.ts';
import type { Auth } from '../../utils/credentials.ts';
import { CliFailure } from '../../utils/failure.ts';

export type ServiceAuth = Extract<Auth, { kind: 'service' }>;

/** The token source of a service credential (PD5). */
export interface ServiceTokens {
  readonly get: (service: ServiceAuth, signal?: AbortSignal) => Promise<string>;
}

const DISCOVERY_PATH = '.well-known/openid-configuration';
const MS_PER_SECOND = 1000;
const LOOPBACK_ALIASES: readonly string[] = ['[::1]', 'localhost'];

function loopbackHosts(primary: string): ReadonlySet<string> {
  return new Set([primary, ...LOOPBACK_ALIASES]);
}

const Discovery = z.object({ token_endpoint: z.url() });
const Token = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

/** One cached token and the instant it stops being usable (PD5). */
interface Held {
  readonly token: string;
  readonly expiresAt: number;
}

/** https, or http to a loopback host for the dev stack (PD5). */
function assertIssuer(issuer: string, loopback: ReadonlySet<string>): void {
  const url = new URL(issuer);
  const loopbackHttp = url.protocol === 'http:' && loopback.has(url.hostname);
  if (url.protocol !== 'https:' && !loopbackHttp) {
    throw new CliFailure('issuer must be https or a loopback host');
  }
}

function discoveryUrl(issuer: string): string {
  const base = issuer.endsWith('/') ? issuer : `${issuer}/`;
  return new URL(DISCOVERY_PATH, base).href;
}

/** Returns the parsed body. Failures name the step and status, never the body (G5). */
async function requestJson(
  fetchFn: typeof fetch,
  step: string,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, init);
  } catch {
    throw new CliFailure(`${step} unreachable`);
  }
  if (!response.ok) {
    throw new CliFailure(`${step} failed: HTTP ${String(response.status)}`);
  }
  try {
    return await response.json();
  } catch {
    throw new CliFailure(`${step} returned no JSON`);
  }
}

async function issue(
  fetchFn: typeof fetch,
  now: () => number,
  loopback: ReadonlySet<string>,
  service: ServiceAuth,
  signal: AbortSignal | null,
): Promise<Held> {
  assertIssuer(service.issuer, loopback);
  const discovery = Discovery.safeParse(
    await requestJson(
      fetchFn,
      'issuer discovery',
      discoveryUrl(service.issuer),
      {
        signal,
      },
    ),
  );
  if (!discovery.success) {
    throw new CliFailure('issuer discovery has a bad shape');
  }
  const basic = Buffer.from(
    `${service.clientId}:${service.clientSecret}`,
  ).toString('base64');
  const token = Token.safeParse(
    await requestJson(fetchFn, 'token request', discovery.data.token_endpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      signal,
    }),
  );
  if (!token.success) {
    throw new CliFailure('token response has a bad shape');
  }
  return {
    token: token.data.access_token,
    expiresAt: now() + token.data.expires_in * MS_PER_SECOND,
  };
}

/**
 * Client-credentials tokens, one cache entry per issuer and client id. The
 * in-flight fetch is the cache entry, so concurrent first calls share one
 * token request. A failed fetch is retried by the next call.
 */
export function createServiceTokens(
  fetchFn: typeof fetch,
  now: () => number,
  loopbackHost: string,
): ServiceTokens {
  const loopback = loopbackHosts(loopbackHost);
  const held = new Map<string, Promise<Held>>();
  return {
    get: async (service, signal) => {
      const key = `${service.issuer}\n${service.clientId}`;
      const prior = held.get(key);
      if (prior !== undefined) {
        const entry = await prior.catch(() => undefined);
        if (entry !== undefined && now() < entry.expiresAt) return entry.token;
      }
      const next = issue(fetchFn, now, loopback, service, signal ?? null);
      held.set(key, next);
      return (await next).token;
    },
  };
}
