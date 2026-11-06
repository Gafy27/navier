import type { Logger } from '../index.ts';
import type { DatabaseConfig } from '../config.ts';
import type { createListener } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';

/** A message channel key: the PD2 payload without `seq` (PD5). */
export interface StreamKey {
  readonly org: OrgId;
  readonly messageId: string;
}

export interface StreamHub {
  /**
   * Resolves `'woken'` on a matching payload, `'tick'` on timeout, abort, or close.
   * `null` waits on the timer only (the conversation channel uses it). The waiter is
   * removed however it ends.
   */
  readonly wait: (
    key: StreamKey | null,
    signal: AbortSignal,
    timeoutMs: number,
  ) => Promise<'woken' | 'tick'>;
}

type Waiter = (outcome: 'woken' | 'tick') => void;

const SEQ = /^[0-9]+$/u;

/** The payload is `<org>|<messageId>|<seq>`. Ids never hold `|`, so the last cut is the seq. */
function keyOfPayload(payload: string): string | undefined {
  const cut = payload.lastIndexOf('|');
  if (cut <= 0) return undefined;
  if (!SEQ.test(payload.slice(cut + 1))) return undefined;
  return payload.slice(0, cut);
}

/**
 * One LISTEN connection for the process, and a map from `<org>|<messageId>`
 * to the waiters on it (PD5, D2). A malformed payload is ignored.
 */
export function createStreamHub(
  listen: typeof createListener,
  deps: { config: DatabaseConfig; log: Logger },
): StreamHub & { readonly close: () => Promise<void> } {
  const waiters = new Map<string, Set<Waiter>>();

  const listener = listen(deps.config, deps.log, 'stream_delta', (payload) => {
    const key = keyOfPayload(payload);
    if (key === undefined) return;
    const set = waiters.get(key);
    if (set === undefined) return;
    for (const waiter of [...set]) waiter('woken');
  });

  const wait: StreamHub['wait'] = (key, signal, timeoutMs) =>
    new Promise((resolve) => {
      if (signal.aborted) {
        resolve('tick');
        return;
      }
      const mapKey = key === null ? undefined : `${key.org}|${key.messageId}`;
      let settled = false;

      const settle: Waiter = (outcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        if (mapKey !== undefined) {
          const set = waiters.get(mapKey);
          set?.delete(settle);
          if (set?.size === 0) waiters.delete(mapKey);
        }
        resolve(outcome);
      };
      const onAbort = (): void => {
        settle('tick');
      };

      const timer = setTimeout(() => {
        settle('tick');
      }, timeoutMs);
      signal.addEventListener('abort', onAbort, { once: true });
      if (mapKey !== undefined) {
        const set = waiters.get(mapKey) ?? new Set<Waiter>();
        set.add(settle);
        waiters.set(mapKey, set);
      }
    });

  return {
    wait,
    close: async () => {
      const pending = [...waiters.values()].flatMap((set) => [...set]);
      waiters.clear();
      for (const waiter of pending) waiter('tick');
      await listener.close();
    },
  };
}
