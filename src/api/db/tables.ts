import type { Generated } from 'kysely';
import { z } from '../../index.ts';
import type { Db, OrgId } from '../../db/index.ts';

/** This unit's table names. */
export const ApiTable = z.enum({
  api_login_state: 'api_login_state',
  api_session: 'api_session',
  api_login_handoff: 'api_login_handoff',
  api_directory: 'api_directory',
});
export type ApiTable = z.infer<typeof ApiTable>;

/** The tables that hold a sealed envelope. Its AAD starts with the table name (PD2). */
export const SealedTable = ApiTable.extract([
  ApiTable.enum.api_login_state,
  ApiTable.enum.api_session,
  ApiTable.enum.api_login_handoff,
]);
export type SealedTable = z.infer<typeof SealedTable>;

/** This unit's tables (B6). The envelope columns mirror `Sealed`. */
export type ApiTables = {
  api_login_state: {
    state: string;
    key_id: string;
    wrapped_key: Buffer;
    wrap_nonce: Buffer;
    data_nonce: Buffer;
    ciphertext: Buffer;
    expires_at: Date;
  };
  api_session: {
    id_hash: string;
    key_id: string;
    wrapped_key: Buffer;
    wrap_nonce: Buffer;
    data_nonce: Buffer;
    ciphertext: Buffer;
    created_at: Generated<Date>;
    refreshed_at: Generated<Date>;
  };
  /** PD1: a one-time code for a loopback login. Only `sha256Hex(code)` is stored. */
  api_login_handoff: {
    code_hash: string;
    key_id: string;
    wrapped_key: Buffer;
    wrap_nonce: Buffer;
    data_nonce: Buffer;
    ciphertext: Buffer;
    challenge: string;
    expires_at: Date;
  };
  /** C2: one append-only stream per `(org_id, type, id)`. The newest row holds the name. */
  api_directory: {
    org_id: OrgId;
    type: string;
    id: string;
    seq: number;
    name: string;
    at: Generated<Date>;
  };
};

/** The envelope columns both sealed tables share (B6). */
export type SealedColumns = Pick<
  ApiTables[SealedTable],
  'key_id' | 'wrapped_key' | 'wrap_nonce' | 'data_nonce' | 'ciphertext'
>;

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function apiView(db: Db) {
  return db.$extendTables<ApiTables>();
}
