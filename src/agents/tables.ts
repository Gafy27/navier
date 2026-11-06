import type { Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `agentsView` to a `Db`. */
export type AgentsTables = {
  agent: {
    org_id: OrgId;
    id: string;
    principal_id: string;
    created_by: string;
    created_at: Generated<Date>;
  };
  agent_version: {
    org_id: OrgId;
    agent_id: string;
    version: number;
    definition: Record<string, unknown>;
    definition_hash: string;
    author_id: string;
    created_at: Generated<Date>;
  };
  agent_head: {
    org_id: OrgId;
    agent_id: string;
    seq: number;
    active_version: number;
    status: string;
    by: string;
    at: Generated<Date>;
  };
  agent_create_key: {
    org_id: OrgId;
    idempotency_key: string;
    agent_id: string;
    definition_hash: string;
    snapshot_seq: number;
  };
  agent_version_publisher: {
    org_id: OrgId;
    agent_id: string;
    version: number;
    published_by: string;
    at: Generated<Date>;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function agentsView(db: Db) {
  return db.$extendTables<AgentsTables>();
}
