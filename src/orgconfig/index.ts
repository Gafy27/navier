import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { ORGCONFIG_AUDIT } from './audit-kinds.ts';
import { parseOrgFirstRow, parseOrgPatch, parseOrgSnapshot } from './config.ts';
import type { OrgFirstRow, OrgPatch, OrgSnapshot } from './config.ts';
import { readKeyFile } from './keyfile.ts';
import { parseProviderInput, readProviderStatus } from './provider.ts';
import { seal } from './seal.ts';
import { orgconfigView } from './tables.ts';
import type { OrgconfigTables } from './tables.ts';

const ADMIN_SCOPE = 'org:config:admin';

export {
  parseOrgPatch,
  pauseTimeoutSchema,
  pauseTimeoutSeconds,
} from './config.ts';
export type { OrgLimits, OrgSnapshot } from './config.ts';
export { listProviders, readProviderStatus } from './provider.ts';
export type { ProviderListing, ProviderStatus } from './provider.ts';
export { ORGCONFIG_AUDIT } from './audit-kinds.ts';
export { orgconfigMigrations } from './migrations.ts';
export { requireKeyFile } from './keyfile.ts';

type ConfigRow = {
  readonly seq: number;
  readonly max_tools_per_version: number;
  readonly max_fallbacks: number;
  readonly max_steps: number;
  readonly pause_timeout: string;
  readonly max_trace_output_bytes: number;
  readonly max_tool_output_bytes: number;
  readonly max_tool_attempts: number;
  readonly stream_replay_ttl: string;
  readonly stream_access_recheck: string;
  readonly stream_poll_hold: string;
  readonly stream_keepalive: string;
  readonly stream_max_lifetime: string;
  readonly max_stream_deltas_per_message: number;
};

const STREAM_COLS = [
  ['streamReplayTtl', 'stream_replay_ttl'],
  ['streamAccessRecheck', 'stream_access_recheck'],
  ['streamPollHold', 'stream_poll_hold'],
  ['streamKeepalive', 'stream_keepalive'],
  ['streamMaxLifetime', 'stream_max_lifetime'],
  ['maxStreamDeltasPerMessage', 'max_stream_deltas_per_message'],
] as const satisfies readonly (readonly [keyof OrgFirstRow, keyof ConfigRow])[];

export type OrgConfigRead =
  | { readonly set: false }
  | {
      readonly set: true;
      readonly snapshot: OrgSnapshot;
      readonly seq: number;
    };

/** A stored row that fails the thirteen-field shape is `internal`; the message names fields only. */
function snapshotOf(row: ConfigRow): Result<OrgSnapshot> {
  const snapshot: Record<string, unknown> = {
    maxToolsPerVersion: row.max_tools_per_version,
    maxFallbacks: row.max_fallbacks,
    maxSteps: row.max_steps,
    pauseTimeout: row.pause_timeout,
    maxTraceOutputBytes: row.max_trace_output_bytes,
    maxToolOutputBytes: row.max_tool_output_bytes,
    maxToolAttempts: row.max_tool_attempts,
  };
  for (const [field, column] of STREAM_COLS) {
    snapshot[field] = row[column];
  }
  const parsed = parseOrgSnapshot(snapshot);
  if (parsed.ok) return parsed;
  return err(appError(ErrorCode.internal, parsed.error.message));
}

/**
 * The newest snapshot for `org`, or the row at `seq`. `{ set: false }` when that row is absent.
 * A stored row that is not a valid snapshot throws; the boundaries answer `internal`.
 */
export async function readOrgConfig(
  db: Db,
  org: OrgId,
  seq?: number,
): Promise<OrgConfigRead> {
  const base = orgconfigView(db)
    .selectFrom('org_config')
    .selectAll()
    .where('org_id', '=', org);
  const row =
    seq === undefined
      ? await base.orderBy('seq', 'desc').limit(1).executeTakeFirst()
      : await base.where('seq', '=', seq).executeTakeFirst();
  if (row === undefined) return { set: false };
  const snapshot = snapshotOf(row);
  if (!snapshot.ok) throw new Error(snapshot.error.message);
  return { set: true, snapshot: snapshot.value, seq: row.seq };
}

/** D10: a column the value omits stays out of the insert, so Postgres applies its `DEFAULT`. */
function streamColumns(value: OrgFirstRow) {
  const columns: Record<string, string | number> = {};
  for (const [field, column] of STREAM_COLS) {
    const v = value[field];
    if (v !== undefined) columns[column] = v;
  }
  return columns;
}

/** D1: the patch over the newest row, or the first-row check when there is none. */
function mergeOver(newest: ConfigRow | undefined, patch: OrgPatch) {
  if (newest === undefined) return parseOrgFirstRow(patch);
  const base = snapshotOf(newest);
  if (!base.ok) return base;
  return parseOrgSnapshot({ ...base.value, ...patch });
}

/** Appends one full snapshot after `org:config:admin` is allowed. A lost race is `aborted`. */
export async function setOrgConfig(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  patch: unknown,
): Promise<Result<{ readonly seq: number }>> {
  const decision = await authz.check(org, caller, ADMIN_SCOPE);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${ADMIN_SCOPE}`));
  }
  const parsed = parseOrgPatch(patch);
  if (!parsed.ok) return parsed;
  const fields = parsed.value;
  return withTransaction(db, async (tx) => {
    const txdb = withTables<OrgconfigTables>(tx);
    const newest = await txdb
      .selectFrom('org_config')
      .selectAll()
      .where('org_id', '=', org)
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst();
    const merged = mergeOver(newest, fields);
    if (!merged.ok) return merged;
    const stored = merged.value;
    const appended = await appendIfNewest<OrgconfigTables, 'org_config'>(txdb, {
      table: 'org_config',
      org,
      key: {},
      accept: () => true,
      row: () => ({
        max_tools_per_version: stored.maxToolsPerVersion,
        max_fallbacks: stored.maxFallbacks,
        max_steps: stored.maxSteps,
        pause_timeout: stored.pauseTimeout,
        max_trace_output_bytes: stored.maxTraceOutputBytes,
        max_tool_output_bytes: stored.maxToolOutputBytes,
        max_tool_attempts: stored.maxToolAttempts,
        ...streamColumns(stored),
        by: caller.principal.id,
      }),
    });
    if (!appended.ok) return appended;
    const audited = await writeAudit(tx, org, {
      kind: ORGCONFIG_AUDIT.configSet,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: { kind: 'org', id: org },
    });
    if (!audited.ok) return audited;
    return ok({ seq: appended.value.seq });
  });
}

const KeyTextSchema = z.string().min(1);

/** The `llm` function's shape, declared here so `orgconfig` does not import `llm` (PD4). */
export type VerifyKey = (
  credentials: {
    readonly adapter: string;
    readonly baseUrl: string;
    readonly apiKey: string;
  },
  signal: AbortSignal,
) => Promise<Result<void>>;

/**
 * Proves `plaintext` with the provider, outside any transaction, then seals it
 * under the current key of `SECRETS_KEYS_FILE` and appends it as the provider's
 * next key revision. A key the provider rejects or cannot check writes nothing.
 * The file contents are dropped on return.
 */
export async function setProviderKey(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  provider: string,
  plaintext: string,
  verifyKey: VerifyKey,
  signal: AbortSignal,
): Promise<Result<{ readonly seq: number }>> {
  const decision = await authz.check(org, caller, ADMIN_SCOPE);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${ADMIN_SCOPE}`));
  }
  if (!KeyTextSchema.safeParse(plaintext).success) {
    return err(appError(ErrorCode.invalid_argument, 'key: invalid'));
  }
  const row = await readProviderStatus(db, org, provider);
  if (!row.set) {
    return err(appError(ErrorCode.not_found, `provider ${provider} unknown`));
  }
  const verified = await verifyKey(
    { adapter: row.adapter, baseUrl: row.baseUrl, apiKey: plaintext },
    signal,
  );
  if (!verified.ok) {
    const { code, message } = verified.error;
    if (message === 'key: rejected') {
      return err(appError(code, `provider ${provider} rejected the key`));
    }
    if (message === 'key: unverified') {
      return err(
        appError(code, `could not verify the key with provider ${provider}`),
      );
    }
    return verified;
  }
  const keyFile = readKeyFile();
  if (!keyFile.ok) return keyFile;
  const { current, keys } = keyFile.value;
  const wrappingKey = keys[current];
  if (wrappingKey === undefined) {
    return err(
      appError(ErrorCode.invalid_argument, 'SECRETS_KEYS_FILE: invalid'),
    );
  }
  return withTransaction(db, async (tx) => {
    const txdb = withTables<OrgconfigTables>(tx);
    const known = await txdb
      .selectFrom('org_provider')
      .select('seq')
      .where('org_id', '=', org)
      .where('provider', '=', provider)
      .limit(1)
      .executeTakeFirst();
    if (known === undefined) {
      return err(appError(ErrorCode.not_found, `provider ${provider} unknown`));
    }
    const appended = await appendIfNewest<OrgconfigTables, 'org_provider_key'>(
      txdb,
      {
        table: 'org_provider_key',
        org,
        key: { provider },
        accept: () => true,
        row: (seq) => {
          const sealed = seal(
            plaintext,
            { org, provider, seq },
            current,
            wrappingKey,
          );
          return {
            provider,
            key_id: sealed.keyId,
            wrapped_key: sealed.wrappedKey,
            wrap_nonce: sealed.wrapNonce,
            data_nonce: sealed.dataNonce,
            ciphertext: sealed.ciphertext,
            by: caller.principal.id,
          };
        },
      },
    );
    if (!appended.ok) return appended;
    const audited = await writeAudit(tx, org, {
      kind: ORGCONFIG_AUDIT.providerKeySet,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: { kind: 'provider', id: provider },
    });
    if (!audited.ok) return audited;
    return ok({ seq: appended.value.seq });
  });
}

/** Appends one provider row after `org:config:admin` is allowed. A lost race is `aborted`. */
export async function setProvider(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  input: unknown,
  allowedAdapters: readonly string[],
): Promise<Result<{ readonly seq: number }>> {
  const decision = await authz.check(org, caller, ADMIN_SCOPE);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${ADMIN_SCOPE}`));
  }
  const parsed = parseProviderInput(input, allowedAdapters);
  if (!parsed.ok) return parsed;
  const row = parsed.value;
  return withTransaction(db, async (tx) => {
    const appended = await appendIfNewest<OrgconfigTables, 'org_provider'>(
      withTables<OrgconfigTables>(tx),
      {
        table: 'org_provider',
        org,
        key: { provider: row.provider },
        accept: () => true,
        row: () => ({
          provider: row.provider,
          adapter: row.adapter,
          base_url: row.baseUrl,
          by: caller.principal.id,
        }),
      },
    );
    if (!appended.ok) return appended;
    const audited = await writeAudit(tx, org, {
      kind: ORGCONFIG_AUDIT.providerSet,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: { kind: 'provider', id: row.provider },
    });
    if (!audited.ok) return audited;
    return ok({ seq: appended.value.seq });
  });
}
