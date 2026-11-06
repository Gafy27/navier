import { readFileSync } from 'node:fs';
import { z } from '../index.ts';
import type { Logger } from '../index.ts';
import type { AuthzConfig } from './authz-config.ts';
import { Credential } from './credential.ts';

const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

interface Held {
  readonly token: Credential;
  readonly expiresAt: number;
}

/** Seconds to milliseconds. A unit, not a limit. */
const MS_PER_S = 10 ** 3;

/** Client-credentials token endpoint settings. The secret is read from `secretFile` once. */
export interface ClientCredentialsConfig {
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly secretFile: string;
  readonly audience?: string;
  readonly timeoutMs: number;
}

/**
 * Returns a function that yields a client-credentials token, or `undefined` when
 * the token endpoint cannot be used. The one held token is reused until it expires.
 */
export function createClientCredentialsToken(
  config: ClientCredentialsConfig,
  logger: Logger,
): () => Promise<Credential | undefined> {
  const secret = new Credential(readFileSync(config.secretFile, 'utf8').trim());
  let held: Held | undefined;

  async function fetchToken(): Promise<Held | undefined> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: secret.reveal(),
    });
    if (config.audience !== undefined) {
      body.set('audience', config.audience);
    }
    try {
      const res = await fetch(config.tokenUrl, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!res.ok) {
        logger.error({ status: res.status }, 'service token request refused');
        return undefined;
      }
      const parsed = tokenResponse.safeParse(await res.json());
      if (!parsed.success) {
        logger.error('service token response malformed');
        return undefined;
      }
      return {
        token: new Credential(parsed.data.access_token),
        expiresAt: Date.now() + parsed.data.expires_in * MS_PER_S,
      };
    } catch {
      logger.error('service token endpoint unreachable');
      return undefined;
    }
  }

  return async () => {
    if (held === undefined || Date.now() >= held.expiresAt) {
      held = await fetchToken();
    }
    return held?.token;
  };
}

/**
 * Returns a function that yields this service's client-credentials token, or
 * `undefined` when the token endpoint cannot be used.
 */
export function createServiceToken(
  config: AuthzConfig,
  logger: Logger,
): () => Promise<Credential | undefined> {
  const credentials: ClientCredentialsConfig = {
    tokenUrl: config.AUTHZ_TOKEN_URL,
    clientId: config.AUTHZ_CLIENT_ID,
    secretFile: config.AUTHZ_CLIENT_SECRET_FILE,
    timeoutMs: config.AUTHZ_TIMEOUT_MS,
  };
  if (config.AUTHZ_AUDIENCE !== undefined) {
    return createClientCredentialsToken(
      { ...credentials, audience: config.AUTHZ_AUDIENCE },
      logger,
    );
  }
  return createClientCredentialsToken(credentials, logger);
}
