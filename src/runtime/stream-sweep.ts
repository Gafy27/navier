import { sql } from 'kysely';
import type { Db } from '../db/index.ts';
import type { RuntimeConfig } from './config.ts';
import type { StreamSweepActivities } from './workflow-types.ts';

export interface StreamSweepDeps {
  readonly db: Db;
  readonly config: RuntimeConfig;
}

/** Deletes up to `batch` expired rows; returns how many were removed. */
export async function deleteExpiredStreamDeltas(
  db: Db,
  batch: number,
): Promise<number> {
  const deleted = await sql<{ org_id: string }>`
    delete from stream_delta d
    where d.ctid in (
      select ctid from stream_delta where expires_at < now() limit ${batch}
    )
    returning d.org_id`.execute(db);
  return deleted.rows.length;
}

/** D3: pages until a batch is short. */
export async function sweepStreamDeltas(deps: StreamSweepDeps): Promise<void> {
  const batch = deps.config.STREAM_SWEEP_BATCH_SIZE;
  for (;;) {
    const n = await deleteExpiredStreamDeltas(deps.db, batch);
    if (n < batch) return;
  }
}

export function streamSweepActivities(
  deps: StreamSweepDeps,
): StreamSweepActivities {
  return {
    sweepStreamDeltas: async () => {
      await sweepStreamDeltas(deps);
    },
  };
}
