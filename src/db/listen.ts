import { sql } from 'kysely';
import pg from 'pg';
import type { Logger } from '../index.ts';
import type { DatabaseConfig } from '../config.ts';
import type { Tx } from './db.ts';

/** The one NOTIFY channel (PD2). */
type Channel = 'stream_delta';

// LISTEN reconnect backoff: connection hygiene, not a stream timing (D4).
// Doubles from the first delay up to the cap; resets after a good connect.
const RECONNECT_FIRST_MS = 250;
const RECONNECT_MAX_MS = 8_000;

/** Sends `payload` on `channel` when the caller's transaction commits. */
export async function notify(
  tx: Tx,
  channel: Channel,
  payload: string,
): Promise<void> {
  await sql`select pg_notify(${channel}, ${payload})`.execute(tx);
}

function errorCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null || !('code' in e)) return undefined;
  return typeof e.code === 'string' ? e.code : undefined;
}

/**
 * One connection outside the pool that LISTENs on `channel` and calls
 * `onPayload` per notification. It reconnects with backoff on error or end
 * and never throws to the caller. `close` ends it and stops reconnecting.
 */
export function createListener(
  config: DatabaseConfig,
  log: Logger,
  channel: Channel,
  onPayload: (payload: string) => void,
): { readonly close: () => Promise<void> } {
  let closed = false;
  let client: pg.Client | undefined;
  let timer: NodeJS.Timeout | undefined;
  let delayMs = RECONNECT_FIRST_MS;

  // Logs the error code only: a pg message or the config may name the URL.
  const drop = (lost: pg.Client, code: string | undefined): void => {
    if (client !== lost) return;
    client = undefined;
    lost.end().catch(() => undefined);
    if (closed) return;
    log.warn(
      { channel, code, delayMs },
      'listen connection lost; reconnecting',
    );
    timer = setTimeout(() => {
      timer = undefined;
      void connect();
    }, delayMs);
    delayMs = Math.min(delayMs * 2, RECONNECT_MAX_MS);
  };

  const connect = async (): Promise<void> => {
    const next = new pg.Client({ connectionString: config.DATABASE_URL });
    client = next;
    next.on('notification', (message) => {
      if (message.channel !== channel || message.payload === undefined) return;
      try {
        onPayload(message.payload);
      } catch (e) {
        log.error({ channel, code: errorCode(e) }, 'listen callback threw');
      }
    });
    next.on('error', (e) => {
      drop(next, errorCode(e));
    });
    next.on('end', () => {
      drop(next, 'end');
    });
    try {
      await next.connect();
      await next.query(`listen ${next.escapeIdentifier(channel)}`);
      if (client === next) delayMs = RECONNECT_FIRST_MS;
    } catch (e) {
      drop(next, errorCode(e));
    }
  };

  void connect();
  return {
    close: async () => {
      closed = true;
      clearTimeout(timer);
      const open = client;
      client = undefined;
      await open?.end().catch(() => undefined);
    },
  };
}
