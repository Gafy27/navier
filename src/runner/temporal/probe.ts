import { Connection } from '@temporalio/client';
import type { ReadinessProbe } from '../../db/index.ts';
import type { TemporalHandle } from './client.ts';

const SERVING: number = 1;

/** Asks the server's health check. Any failure or abort answers no. */
export function temporalProbe(handle: TemporalHandle): ReadinessProbe {
  return {
    name: 'temporal',
    check: async (signal) => {
      if (signal.aborted) return false;
      const { connection } = handle.client;
      if (!(connection instanceof Connection)) return false;
      try {
        const aborted = new Promise<never>((_, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
        const health = connection.withAbortSignal(signal, () =>
          connection.healthService.check({ service: '' }),
        );
        health.catch(() => undefined);
        const res = await Promise.race([health, aborted]);
        const status: number = res.status;
        return status === SERVING;
      } catch {
        return false;
      }
    },
  };
}
