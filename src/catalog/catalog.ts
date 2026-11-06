import { isDeepStrictEqual } from 'node:util';
import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId, Tx } from '../db/index.ts';
import { SCOPE_GRAMMAR } from '../identity/index.ts';
import type { Authz, Caller, Principal } from '../identity/index.ts';
import { readOrgConfig } from '../orgconfig/index.ts';
import { CATALOG_AUDIT } from './audit-kinds.ts';
import type { CatalogConfig } from './config.ts';
import { checkServed } from './serving.ts';
import { catalogView } from './tables.ts';
import type { CatalogTables } from './tables.ts';

const Approval = ['never_ask', 'low', 'medium', 'high'] as const;
const NO_RETRY_ATTEMPTS = 1;

const jsonObject = z.record(z.string(), z.unknown());
const positiveInt = z.number().int().min(1);

export const ToolEntryInputSchema = z.strictObject({
  key: z.string().refine((key) => SCOPE_GRAMMAR.tool.validId(key)),
  implementationVersion: positiveInt,
  name: z.string().min(1),
  description: z.string(),
  inputSchema: jsonObject,
  retryOnInterrupt: z.boolean().default(false),
  toolAttempts: positiveInt.optional(),
  maxToolOutputBytes: positiveInt.optional(),
  approval: z.enum(Approval),
  configSchema: jsonObject.nullish(),
});

export type ToolEntryInput = z.input<typeof ToolEntryInputSchema>;

/** The stored entry plus `enabled`, the newest status. */
export interface ToolEntry {
  readonly org: OrgId;
  readonly key: string;
  readonly implementationVersion: number;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly retryOnInterrupt: boolean;
  readonly toolAttempts: number;
  readonly maxToolOutputBytes: number;
  readonly approval: (typeof Approval)[number];
  readonly configSchema: Record<string, unknown> | null;
  readonly enabled: boolean;
}

type Query = ReturnType<typeof catalogView>;
type EntryRow = Awaited<ReturnType<typeof selectEntry>>;

function selectEntry(
  q: Query,
  org: OrgId,
  key: string,
  implementationVersion: number,
) {
  return q
    .selectFrom('tool_entry')
    .selectAll()
    .where('org_id', '=', org)
    .where('key', '=', key)
    .where('implementation_version', '=', implementationVersion)
    .executeTakeFirst();
}

async function newestEnabled(
  q: Query,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<boolean> {
  const row = await q
    .selectFrom('tool_status')
    .select('enabled')
    .where('org_id', '=', org)
    .where('key', '=', key)
    .where('implementation_version', '=', implementationVersion)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.enabled ?? false;
}

function toEntry(row: NonNullable<EntryRow>, enabled: boolean): ToolEntry {
  return {
    org: row.org_id,
    key: row.key,
    implementationVersion: row.implementation_version,
    name: row.name,
    description: row.description,
    inputSchema: row.input_schema,
    retryOnInterrupt: row.retry_on_interrupt,
    toolAttempts: row.tool_attempts,
    maxToolOutputBytes: row.max_tool_output_bytes,
    approval: row.approval as ToolEntry['approval'],
    configSchema: row.config_schema,
    enabled,
  };
}

async function load(
  q: Query,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<Result<ToolEntry>> {
  const row = await selectEntry(q, org, key, implementationVersion);
  if (row === undefined) {
    return err(appError(ErrorCode.not_found, 'tool entry not found'));
  }
  return ok(
    toEntry(row, await newestEnabled(q, org, key, implementationVersion)),
  );
}

function containsRef(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRef);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([name, child]) => name === '$ref' || containsRef(child),
  );
}

function invalid(message: string): Result<never> {
  return err(appError(ErrorCode.invalid_argument, message));
}

/** Snapshot fields an omitted tool entry copies. A set value is kept. */
export interface ToolLimitDefaults {
  readonly maxToolOutputBytes: number;
  readonly maxToolAttempts: number;
}

/** Fills an omitted output cap, and an omitted `toolAttempts` when retry is set. */
export function fillToolLimits(
  input: {
    readonly retryOnInterrupt: boolean;
    readonly toolAttempts?: number | undefined;
    readonly maxToolOutputBytes?: number | undefined;
  },
  defaults: ToolLimitDefaults,
): { readonly toolAttempts: number; readonly maxToolOutputBytes: number } {
  return {
    toolAttempts: input.retryOnInterrupt
      ? (input.toolAttempts ?? defaults.maxToolAttempts)
      : NO_RETRY_ATTEMPTS,
    maxToolOutputBytes: input.maxToolOutputBytes ?? defaults.maxToolOutputBytes,
  };
}

/** Registers a disabled entry. An identical re-register writes nothing. */
export async function registerTool(
  tx: Tx,
  _config: CatalogConfig,
  org: OrgId,
  input: unknown,
  actor: Principal,
): Promise<Result<ToolEntry>> {
  const parsed = ToolEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.join('.') || '(root)');
    return invalid(
      `invalid tool entry: ${[...new Set(paths)].sort().join(', ')}`,
    );
  }
  const value = parsed.data;
  if (
    !value.retryOnInterrupt &&
    value.toolAttempts !== undefined &&
    value.toolAttempts !== NO_RETRY_ATTEMPTS
  ) {
    return invalid('toolAttempts requires retryOnInterrupt');
  }
  const orgConfig = await readOrgConfig(tx, org);
  if (!orgConfig.set) return invalid('org config: not set');
  const limits = fillToolLimits(value, orgConfig.snapshot);
  if (limits.maxToolOutputBytes < 1) {
    return invalid('maxToolOutputBytes: invalid');
  }
  if (limits.toolAttempts < 1) return invalid('maxToolAttempts: invalid');
  const { maxToolOutputBytes } = limits;
  const configSchema = value.configSchema ?? null;
  if (containsRef(configSchema)) return invalid('configSchema has $ref');

  const q = withTables<CatalogTables>(tx);
  const row = {
    org_id: org,
    key: value.key,
    implementation_version: value.implementationVersion,
    name: value.name,
    description: value.description,
    input_schema: value.inputSchema,
    retry_on_interrupt: value.retryOnInterrupt,
    tool_attempts: limits.toolAttempts,
    max_tool_output_bytes: maxToolOutputBytes,
    approval: value.approval,
    config_schema: configSchema,
    registered_by: actor.id,
  };
  const inserted = await q
    .insertInto('tool_entry')
    .values(row)
    .onConflict((oc) => oc.doNothing())
    .returning('key')
    .executeTakeFirst();
  if (inserted === undefined) {
    const stored = await load(q, org, value.key, value.implementationVersion);
    if (!stored.ok) return stored;
    const same = isDeepStrictEqual(
      { ...toEntry({ ...row, at: new Date() }, false), enabled: false },
      { ...stored.value, enabled: false },
    );
    return same
      ? stored
      : err(appError(ErrorCode.already_exists, 'tool entry exists'));
  }
  await q
    .insertInto('tool_status')
    .values({
      org_id: org,
      key: value.key,
      implementation_version: value.implementationVersion,
      seq: 1,
      enabled: false,
      by: actor.id,
    })
    .execute();
  const audited = await writeAudit(tx, org, {
    kind: CATALOG_AUDIT.toolRegistered,
    actor: { kind: actor.kind, id: actor.id },
    target: {
      kind: 'tool',
      id: `${value.key}@${String(value.implementationVersion)}`,
    },
  });
  if (!audited.ok) return audited;
  return load(q, org, value.key, value.implementationVersion);
}

/** Appends an `enabled` value after `tool:enable:<key>` is allowed. Any other decision refuses. */
export async function enableTool(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  key: string,
  implementationVersion: number,
  enabled: boolean,
): Promise<Result<ToolEntry>> {
  const scope = `tool:enable:${key}`;
  const decision = await authz.check(org, caller, scope);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${scope}`));
  }
  return withTransaction(db, async (tx) => {
    const q = withTables<CatalogTables>(tx);
    const entry = await load(q, org, key, implementationVersion);
    if (!entry.ok) return entry;
    const appended = await appendIfNewest<CatalogTables, 'tool_status'>(q, {
      table: 'tool_status',
      org,
      key: { key, implementation_version: implementationVersion },
      accept: () => true,
      row: () => ({
        key,
        implementation_version: implementationVersion,
        enabled,
        by: caller.principal.id,
      }),
    });
    if (!appended.ok) return appended;
    const audited = await writeAudit(tx, org, {
      kind: enabled ? CATALOG_AUDIT.toolEnabled : CATALOG_AUDIT.toolDisabled,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: { kind: 'tool', id: `${key}@${String(implementationVersion)}` },
    });
    if (!audited.ok) return audited;
    return ok({ ...entry.value, enabled });
  });
}

/** True when any implementation version of `key` is registered for `org`. */
export async function hasToolKey(
  db: Db,
  org: OrgId,
  key: string,
): Promise<boolean> {
  const row = await catalogView(db)
    .selectFrom('tool_entry')
    .select('key')
    .where('org_id', '=', org)
    .where('key', '=', key)
    .limit(1)
    .executeTakeFirst();
  return row !== undefined;
}

/** Reads one entry. Another org's entry is `not_found`. */
export function getTool(
  db: Db,
  org: OrgId,
  key: string,
  implementationVersion: number,
): Promise<Result<ToolEntry>> {
  return load(catalogView(db), org, key, implementationVersion);
}

/** `ok`, or `invalid_argument` naming the first ref that is missing, at another version, not served, or disabled. */
export async function checkAssignable(
  tx: Tx,
  org: OrgId,
  refs: readonly { key: string; implementationVersion: number }[],
): Promise<Result<void>> {
  const q = withTables<CatalogTables>(tx);
  for (const ref of refs) {
    const versions = await q
      .selectFrom('tool_entry')
      .select('implementation_version')
      .where('org_id', '=', org)
      .where('key', '=', ref.key)
      .execute();
    if (versions.length === 0) return invalid(`${ref.key}: missing`);
    if (
      !versions.some(
        (v) => v.implementation_version === ref.implementationVersion,
      )
    ) {
      return invalid(`${ref.key}: version`);
    }
    const served = await checkServed(tx, org, [ref]);
    if (!served.ok) return served;
    if (!(await newestEnabled(q, org, ref.key, ref.implementationVersion))) {
      return invalid(`${ref.key}: disabled`);
    }
  }
  return ok(undefined);
}

function failingPath(e: ErrorObject): string {
  const path = e.instancePath.split('/').slice(1);
  if (e.keyword === 'required') {
    path.push((e.params as { missingProperty: string }).missingProperty);
  }
  return path.length === 0 ? '(root)' : path.join('.');
}

/** Checks `config` against a draft-07 `schema`. The error names a path, never a value. */
export function validateToolConfig(
  schema: object,
  config: object,
): Result<void> {
  if (containsRef(schema)) return invalid('schema has $ref');
  let validate;
  try {
    validate = new Ajv().compile(schema);
  } catch {
    return invalid('invalid schema');
  }
  if (validate(config)) return ok(undefined);
  const first = validate.errors?.[0];
  return invalid(
    `invalid config at ${first === undefined ? '(root)' : failingPath(first)}`,
  );
}

const inputValidators = new Map<string, ValidateFunction>();

/**
 * Checks a tool call's `input` against the entry's draft-07 input schema. The
 * error names a path, never a value. Validators are cached per entry: entries
 * are immutable.
 */
export function validateToolInput(
  entry: ToolEntry,
  input: unknown,
): Result<void> {
  const cacheKey = `${entry.org}|${entry.key}|${String(entry.implementationVersion)}`;
  let validate = inputValidators.get(cacheKey);
  if (validate === undefined) {
    validate = new Ajv().compile(entry.inputSchema);
    inputValidators.set(cacheKey, validate);
  }
  if (validate(input)) return ok(undefined);
  const first = validate.errors?.[0];
  return invalid(
    `invalid input at ${first === undefined ? '(root)' : failingPath(first)}`,
  );
}
