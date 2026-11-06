import type { Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `orgconfigView` to a `Db`. */
export type OrgconfigTables = {
  org_config: {
    org_id: OrgId;
    seq: number;
    max_tools_per_version: number;
    max_fallbacks: number;
    max_steps: number;
    pause_timeout: string;
    max_trace_output_bytes: number;
    max_tool_output_bytes: number;
    max_tool_attempts: number;
    stream_replay_ttl: Generated<string>;
    stream_access_recheck: Generated<string>;
    stream_poll_hold: Generated<string>;
    stream_keepalive: Generated<string>;
    stream_max_lifetime: Generated<string>;
    max_stream_deltas_per_message: Generated<number>;
    by: string;
    at: Generated<Date>;
  };
  org_provider: {
    org_id: OrgId;
    provider: string;
    seq: number;
    adapter: string;
    base_url: string;
    by: string;
    at: Generated<Date>;
  };
  org_provider_key: {
    org_id: OrgId;
    provider: string;
    seq: number;
    key_id: string;
    wrapped_key: Buffer;
    wrap_nonce: Buffer;
    data_nonce: Buffer;
    ciphertext: Buffer;
    by: string;
    at: Generated<Date>;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function orgconfigView(db: Db) {
  return db.$extendTables<OrgconfigTables>();
}
