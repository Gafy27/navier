import type { Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `catalogView` to a `Db`. */
export type CatalogTables = {
  tool_entry: {
    org_id: OrgId;
    key: string;
    implementation_version: number;
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    retry_on_interrupt: boolean;
    tool_attempts: number;
    max_tool_output_bytes: number;
    approval: string;
    config_schema: Record<string, unknown> | null;
    registered_by: string;
    at: Generated<Date>;
  };
  tool_status: {
    org_id: OrgId;
    key: string;
    implementation_version: number;
    seq: number;
    enabled: boolean;
    by: string;
    at: Generated<Date>;
  };
  tool_serving: {
    org_id: OrgId;
    key: string;
    implementation_version: number;
    seq: number;
    status: string;
    by: string | null;
    at: Generated<Date>;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function catalogView(db: Db) {
  return db.$extendTables<CatalogTables>();
}
