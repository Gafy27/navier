import type { Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `modelsView` to a `Db`. */
export type ModelsTables = {
  model_policy: {
    org_id: OrgId;
    provider: string;
    model: string;
    seq: number;
    enabled: boolean;
    degraded: boolean;
    by: string;
    at: Generated<Date>;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function modelsView(db: Db) {
  return db.$extendTables<ModelsTables>();
}
