import { createHash } from 'node:crypto';
import { appError, err, ErrorCode, ok, requirePageLimit } from '../index.ts';
import type { Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import {
  checkAssignable,
  getTool,
  validateToolConfig,
} from '../catalog/index.ts';
import { checkSavedModels } from '../models/index.ts';
import {
  createAgentPrincipal,
  formatScope,
  SCOPE_GRAMMAR,
} from '../identity/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { readOrgConfig } from '../orgconfig/index.ts';
import { AGENTS_AUDIT } from './audit-kinds.ts';
import type { AgentsConfig } from './config.ts';
import {
  checkStoredCaps,
  fillVersionLimits,
  parseAgentDocument,
} from './document.ts';
import type { AgentDefinition } from './document.ts';
import { definitionHash } from './hash.ts';
import {
  AgentStatus,
  holds,
  loadRecord,
  newestHead,
  requireScope,
} from './head.ts';
import type { AgentRecord } from './head.ts';
import { agentUse } from './use.ts';
import { agentsView } from './tables.ts';
import type { AgentsTables } from './tables.ts';
import { toVersion } from './version.ts';
import type { VersionRecord } from './version.ts';

export interface SaveResult {
  readonly id: string;
  readonly version: number;
  readonly changed: boolean;
}

export interface SaveBody {
  readonly id?: string;
  readonly idempotencyKey?: string;
  readonly document: unknown;
}

export interface StoreDeps {
  readonly db: Db;
  readonly authz: Authz;
}

export interface SaveDeps extends StoreDeps {
  readonly config: AgentsConfig;
}

const KEY_MAX = 64;
const UNIQUE_VIOLATION = '23505';
const STAKES = ['never_ask', 'low', 'medium', 'high'] as const;
const UUID_V5_BYTE = 0x50;
const UUID_VARIANT_BYTE = 0x80;
const UUID_BYTES = 16;

function hasPgCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === code;
}

function invalid(message: string): Result<never> {
  return err(appError(ErrorCode.invalid_argument, message));
}

/** The agent id for a create: a UUID formatted from SHA-256 over org, 0x00, key. */
export function deriveAgentId(org: OrgId, key: string): string {
  const digest = createHash('sha256')
    .update(
      Buffer.concat([Buffer.from(org), Buffer.from([0]), Buffer.from(key)]),
    )
    .digest()
    .subarray(0, UUID_BYTES);
  digest[6] = ((digest[6] ?? 0) & 0x0f) | UUID_V5_BYTE;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | UUID_VARIANT_BYTE;
  const hex = digest.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function checkBody(body: SaveBody): Result<void> {
  const { id, idempotencyKey: key } = body;
  if ((id === undefined) === (key === undefined)) {
    return invalid('a save carries exactly one of id and idempotencyKey');
  }
  if (id !== undefined && !SCOPE_GRAMMAR.agent.validId(id)) {
    return invalid('invalid id');
  }
  if (
    key !== undefined &&
    (key.length > KEY_MAX || !SCOPE_GRAMMAR.agent.validId(key))
  ) {
    return invalid('idempotencyKey: invalid');
  }
  return ok(undefined);
}

/** Tool-level checks of D3 step 7, read-only. */
async function checkToolRefs(
  db: Db,
  org: OrgId,
  def: AgentDefinition,
): Promise<Result<void>> {
  const assignable = await withTransaction(db, (tx) =>
    checkAssignable(tx, org, def.tools),
  );
  if (!assignable.ok) return assignable;
  for (const ref of def.tools) {
    const entry = await getTool(db, org, ref.key, ref.implementationVersion);
    if (!entry.ok) return entry;
    if (ref.config !== null) {
      if (entry.value.configSchema === null) {
        return invalid(`tools.${ref.key}.config: no schema`);
      }
      const valid = validateToolConfig(entry.value.configSchema, ref.config);
      if (!valid.ok)
        return invalid(`tools.${ref.key}.config: ${valid.error.message}`);
    }
    if (
      ref.approval !== null &&
      STAKES.indexOf(ref.approval) < STAKES.indexOf(entry.value.approval)
    ) {
      return invalid(`tools.${ref.key}.approval: weaker than the entry`);
    }
  }
  return ok(undefined);
}

async function writeVersionAndHead(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  id: string,
  def: AgentDefinition,
  hash: string,
  expectedSeq: number | undefined,
): Promise<Result<number>> {
  const q = withTables<AgentsTables>(tx);
  const newest = await q
    .selectFrom('agent_version')
    .select('version')
    .where('org_id', '=', org)
    .where('agent_id', '=', id)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
  const version = (newest?.version ?? 0) + 1;
  try {
    await q
      .insertInto('agent_version')
      .values({
        org_id: org,
        agent_id: id,
        version,
        definition: def as unknown as Record<string, unknown>,
        definition_hash: hash,
        author_id: caller.principal.id,
      })
      .execute();
  } catch (e) {
    if (hasPgCode(e, UNIQUE_VIOLATION)) {
      return err(appError(ErrorCode.aborted, 'lost the race to save', e));
    }
    throw e;
  }
  const appended = await appendIfNewest<AgentsTables, 'agent_head'>(q, {
    table: 'agent_head',
    org,
    key: { agent_id: id },
    accept: (head) => head?.seq === expectedSeq,
    row: () => ({
      agent_id: id,
      active_version: version,
      status: AgentStatus.active,
      by: caller.principal.id,
    }),
  });
  if (!appended.ok) return appended;
  return ok(version);
}

async function audit(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  kind: string,
  id: string,
): Promise<Result<void>> {
  return writeAudit(tx, org, {
    kind,
    actor: { kind: caller.principal.kind, id: caller.principal.id },
    target: { kind: 'agent', id },
  });
}

async function createRows(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  id: string,
  key: string,
  def: AgentDefinition,
  hash: string,
  snapshotSeq: number,
): Promise<Result<SaveResult>> {
  const assignable = await checkAssignable(tx, org, def.tools);
  if (!assignable.ok) return assignable;
  const q = withTables<AgentsTables>(tx);
  try {
    const principal = await createAgentPrincipal(tx, org, id, caller.principal);
    if (!principal.ok) return principal;
    await q
      .insertInto('agent')
      .values({
        org_id: org,
        id,
        principal_id: principal.value.id,
        created_by: caller.principal.id,
      })
      .execute();
    await q
      .insertInto('agent_create_key')
      .values({
        org_id: org,
        idempotency_key: key,
        agent_id: id,
        definition_hash: hash,
        snapshot_seq: snapshotSeq,
      })
      .execute();
  } catch (e) {
    if (hasPgCode(e, UNIQUE_VIOLATION)) {
      return err(appError(ErrorCode.aborted, 'lost the race to create', e));
    }
    throw e;
  }
  const version = await writeVersionAndHead(
    tx,
    org,
    caller,
    id,
    def,
    hash,
    undefined,
  );
  if (!version.ok) return version;
  const audited = await audit(tx, org, caller, AGENTS_AUDIT.created, id);
  if (!audited.ok) return audited;
  return ok({ id, version: version.value, changed: true });
}

async function updateRows(
  tx: Tx,
  org: OrgId,
  caller: Caller,
  id: string,
  def: AgentDefinition,
  hash: string,
  headSeq: number,
): Promise<Result<SaveResult>> {
  const assignable = await checkAssignable(tx, org, def.tools);
  if (!assignable.ok) return assignable;
  const q = withTables<AgentsTables>(tx);
  const head = await newestHead(q, org, id);
  if (head?.seq !== headSeq) {
    return err(appError(ErrorCode.aborted, 'newest head changed'));
  }
  const active = await q
    .selectFrom('agent_version')
    .select('definition_hash')
    .where('org_id', '=', org)
    .where('agent_id', '=', id)
    .where('version', '=', head.activeVersion)
    .executeTakeFirstOrThrow();
  if (active.definition_hash === hash) {
    return ok({ id, version: head.activeVersion, changed: false });
  }
  const version = await writeVersionAndHead(
    tx,
    org,
    caller,
    id,
    def,
    hash,
    headSeq,
  );
  if (!version.ok) return version;
  const audited = await audit(tx, org, caller, AGENTS_AUDIT.versionSaved, id);
  if (!audited.ok) return audited;
  return ok({ id, version: version.value, changed: true });
}

/** Create (`idempotencyKey`) or update (`id`) in the D3 order: every check, then the writes. */
export async function saveAgent(
  deps: SaveDeps,
  caller: Caller,
  org: OrgId,
  body: SaveBody,
): Promise<Result<SaveResult>> {
  const { db, authz } = deps;
  const bodyOk = checkBody(body);
  if (!bodyOk.ok) return bodyOk;
  const parsed = parseAgentDocument(body.document);
  if (!parsed.ok) return parsed;
  const q = agentsView(db);

  const key = body.idempotencyKey;
  const createId = key === undefined ? undefined : deriveAgentId(org, key);
  const stored =
    key === undefined
      ? undefined
      : await q
          .selectFrom('agent_create_key')
          .select(['definition_hash', 'snapshot_seq'])
          .where('org_id', '=', org)
          .where('idempotency_key', '=', key)
          .executeTakeFirst();
  const orgConfig =
    stored === undefined
      ? await readOrgConfig(db, org)
      : await readOrgConfig(db, org, stored.snapshot_seq);
  if (!orgConfig.set) return invalid('org config: not set');
  const def = fillVersionLimits(parsed.value, orgConfig.snapshot);
  const hash = definitionHash(def);
  if (stored !== undefined && createId !== undefined) {
    if (stored.definition_hash !== hash) {
      return err(
        appError(
          ErrorCode.already_exists,
          'idempotencyKey: reused with another document',
        ),
      );
    }
    const head = await newestHead(q, org, createId);
    if (head === undefined) return invalid('idempotencyKey: no agent');
    return ok({ id: createId, version: head.activeVersion, changed: false });
  }

  const caps = checkStoredCaps(def);
  if (!caps.ok) return caps;
  const models = await checkSavedModels(db, org, def);
  if (!models.ok) return models;

  let updateHead: { readonly id: string; readonly seq: number } | undefined;
  if (createId === undefined) {
    const id = body.id ?? '';
    const head = await newestHead(q, org, id);
    if (head === undefined) {
      return err(appError(ErrorCode.not_found, 'agent not found'));
    }
    const readable = await mayRead(deps, caller, org, id);
    if (!readable.ok) return readable;
    if (head.status === AgentStatus.archived) return invalid('agent_archived');
    updateHead = { id, seq: head.seq };
    const writable = await requireScope(
      authz,
      org,
      caller,
      formatScope({ resource: 'agent', action: 'write', id }),
    );
    if (!writable.ok) return writable;
  } else {
    const creatable = await requireScope(
      authz,
      org,
      caller,
      formatScope({ resource: 'agent_create', action: 'create' }),
    );
    if (!creatable.ok) return creatable;
  }

  for (const ref of def.tools) {
    const assignable = await requireScope(
      authz,
      org,
      caller,
      formatScope({ resource: 'tool', action: 'assign', id: ref.key }),
    );
    if (!assignable.ok) return assignable;
  }
  const refs = await checkToolRefs(db, org, def);
  if (!refs.ok) return refs;

  if (updateHead !== undefined) {
    const head = updateHead;
    return withTransaction(db, (tx) =>
      updateRows(tx, org, caller, head.id, def, hash, head.seq),
    );
  }
  if (key === undefined || createId === undefined) {
    return invalid('a save carries exactly one of id and idempotencyKey');
  }
  const registered = await authz.registerAgent(caller, org, createId);
  if (!registered.ok) return registered;
  return withTransaction(db, (tx) =>
    createRows(tx, org, caller, createId, key, def, hash, orgConfig.seq),
  );
}

/** A use of the agent (CheckAgentUse, version omitted) or `agent:write`. Neither is `not_found`. */
export async function mayRead(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
): Promise<Result<void>> {
  const use = await agentUse(deps.authz, org, caller, id);
  if (!use.ok) return use;
  if (use.value.kind !== 'not_visible') return ok(undefined);
  const written = await holds(
    deps.authz,
    org,
    caller,
    formatScope({ resource: 'agent', action: 'write', id }),
  );
  if (!written.ok) return written;
  if (written.value) return ok(undefined);
  return err(appError(ErrorCode.not_found, 'agent not found'));
}

/** The record and one version: `version` when given, else the active one. */
export async function readAgent(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
  version?: number,
): Promise<
  Result<{ readonly record: AgentRecord; readonly version: VersionRecord }>
> {
  const q = agentsView(deps.db);
  const record = await loadRecord(q, org, id);
  if (!record.ok) return record;
  const readable = await mayRead(deps, caller, org, id);
  if (!readable.ok) return readable;
  const row = await q
    .selectFrom('agent_version')
    .selectAll()
    .where('org_id', '=', org)
    .where('agent_id', '=', id)
    .where('version', '=', version ?? record.value.activeVersion)
    .executeTakeFirst();
  if (row === undefined) {
    return err(appError(ErrorCode.not_found, 'version not found'));
  }
  return ok({ record: record.value, version: toVersion(row) });
}

/** Versions newest first, below `before` when given. Same read rule as `readAgent`. */
export async function listVersions(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
  limit: number,
  before?: number,
): Promise<Result<VersionRecord[]>> {
  const limitOk = requirePageLimit(limit);
  if (!limitOk.ok) return limitOk;
  const q = agentsView(deps.db);
  const record = await loadRecord(q, org, id);
  if (!record.ok) return record;
  const readable = await mayRead(deps, caller, org, id);
  if (!readable.ok) return readable;
  let query = q
    .selectFrom('agent_version')
    .selectAll()
    .where('org_id', '=', org)
    .where('agent_id', '=', id)
    .orderBy('version', 'desc')
    .limit(limit);
  if (before !== undefined) query = query.where('version', '<', before);
  return ok((await query.execute()).map(toVersion));
}

async function setStatus(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
  status: AgentStatus,
): Promise<Result<AgentRecord>> {
  const q = agentsView(deps.db);
  const current = await loadRecord(q, org, id);
  if (!current.ok) return current;
  const readable = await mayRead(deps, caller, org, id);
  if (!readable.ok) return readable;
  const admin = await requireScope(
    deps.authz,
    org,
    caller,
    formatScope({ resource: 'agent', action: 'admin', id }),
  );
  if (!admin.ok) return admin;
  if (current.value.status === status) return current;
  return withTransaction(deps.db, async (tx) => {
    const appended = await appendIfNewest<AgentsTables, 'agent_head'>(
      withTables<AgentsTables>(tx),
      {
        table: 'agent_head',
        org,
        key: { agent_id: id },
        accept: (head) => head?.status === current.value.status,
        row: () => ({
          agent_id: id,
          active_version: current.value.activeVersion,
          status,
          by: caller.principal.id,
        }),
      },
    );
    if (!appended.ok) return appended;
    const kind =
      status === AgentStatus.archived
        ? AGENTS_AUDIT.archived
        : AGENTS_AUDIT.restored;
    const audited = await audit(tx, org, caller, kind, id);
    if (!audited.ok) return audited;
    return ok({ ...current.value, status });
  });
}

/** Needs `agent:admin:<id>`. Already archived: returns the record, writes nothing. */
export function archiveAgent(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
): Promise<Result<AgentRecord>> {
  return setStatus(deps, caller, org, id, AgentStatus.archived);
}

/** Needs `agent:admin:<id>`. Already active: returns the record, writes nothing. */
export function restoreAgent(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
): Promise<Result<AgentRecord>> {
  return setStatus(deps, caller, org, id, AgentStatus.active);
}
