import { sql } from 'kysely';
import type { Db } from './db.ts';

/** A named check that answers yes or no under an abort signal. */
export interface ReadinessProbe {
  readonly name: string;
  readonly check: (signal: AbortSignal) => Promise<boolean>;
}

/** Runs `select 1`. Any failure or abort answers no. */
export function postgresProbe(db: Db): ReadinessProbe {
  return {
    name: 'postgres',
    check: async (signal) => {
      if (signal.aborted) return false;
      const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('aborted'));
          },
          { once: true },
        );
      });
      try {
        await Promise.race([sql`select 1`.execute(db), aborted]);
        return true;
      } catch {
        return false;
      }
    },
  };
}
