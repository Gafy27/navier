import type { Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `identityView` to a `Db`. */
export type IdentityTables = {
  agent_principal: {
    org_id: OrgId;
    agent_id: string;
    principal_id: string;
    created_by: string;
    created_at: Generated<Date>;
  };
  scope_request: {
    org_id: OrgId;
    id: Generated<string>;
    principal_id: string;
    scope: string;
    requested_by: string;
    at: Generated<Date>;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function identityView(db: Db) {
  return db.$extendTables<IdentityTables>();
}
