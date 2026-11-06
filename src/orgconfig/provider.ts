import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { orgconfigView } from './tables.ts';

/** Non-empty, with no leading or trailing whitespace. Same rule as a model ref. */
const PLAIN_TEXT = /^\S(?:.*\S)?$/u;

const plainText = z.string().regex(PLAIN_TEXT);

export type ProviderInput = {
  readonly provider: string;
  readonly adapter: string;
  readonly baseUrl: string;
};

export type ProviderStatus =
  | { readonly set: false }
  | {
      readonly set: true;
      readonly adapter: string;
      readonly baseUrl: string;
      readonly seq: number;
      readonly hasKey: boolean;
      readonly keyRevision: number | null;
    };

const ProviderShapeSchema = z.strictObject({
  provider: plainText,
  adapter: plainText,
  baseUrl: z.string(),
});

function acceptedBaseUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hostname === '') return false;
  if (url.protocol === 'https:') return true;
  // D3: http only when NODE_ENV is test. The signature does not carry it.
  // eslint-disable-next-line no-restricted-syntax
  const env = process.env;
  return url.protocol === 'http:' && env['NODE_ENV'] === 'test';
}

function issueFields(issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'unrecognized_keys') return [...issue.keys];
  const path = issue.path.map(String).join('.');
  return path === '' ? [] : [path];
}

function invalidFields(fields: readonly string[]): Result<never> {
  const unique = [...new Set(fields)].sort();
  const message =
    unique.length === 0
      ? 'provider: invalid'
      : unique.map((field) => `${field}: invalid`).join(', ');
  return err(appError(ErrorCode.invalid_argument, message));
}

/** Names `provider`, `adapter`, or `baseUrl`. The message never includes the URL. */
export function parseProviderInput(
  raw: unknown,
  allowedAdapters: readonly string[],
): Result<ProviderInput> {
  const parsed = ProviderShapeSchema.safeParse(raw);
  if (!parsed.success) {
    return invalidFields(parsed.error.issues.flatMap(issueFields));
  }
  const input = parsed.data;
  const fields: string[] = [];
  if (!allowedAdapters.includes(input.adapter)) fields.push('adapter');
  if (!acceptedBaseUrl(input.baseUrl)) fields.push('baseUrl');
  if (fields.length > 0) return invalidFields(fields);
  return ok(input);
}

/** The newest provider row for this org, or `{ set: false }` when it has none. */
export async function readProviderStatus(
  db: Db,
  org: OrgId,
  provider: string,
): Promise<ProviderStatus> {
  const row = await orgconfigView(db)
    .selectFrom('org_provider')
    .select(['adapter', 'base_url', 'seq'])
    .where('org_id', '=', org)
    .where('provider', '=', provider)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (row === undefined) return { set: false };
  const key = await orgconfigView(db)
    .selectFrom('org_provider_key')
    .select('seq')
    .where('org_id', '=', org)
    .where('provider', '=', provider)
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  return {
    set: true,
    adapter: row.adapter,
    baseUrl: row.base_url,
    seq: row.seq,
    hasKey: key !== undefined,
    keyRevision: key?.seq ?? null,
  };
}

export interface ProviderListing {
  readonly provider: string;
  readonly adapter: string;
  readonly baseUrl: string;
  readonly seq: number;
  readonly hasKey: boolean;
  readonly keyRevision: number | null;
}

/** The newest row of each provider in `org`, by name, with its newest key revision. No sealed column. */
export async function listProviders(
  db: Db,
  org: OrgId,
): Promise<readonly ProviderListing[]> {
  const q = orgconfigView(db);
  const rows = await q
    .selectFrom('org_provider')
    .distinctOn('provider')
    .select(['provider', 'adapter', 'base_url', 'seq'])
    .where('org_id', '=', org)
    .orderBy('provider')
    .orderBy('seq', 'desc')
    .execute();
  const keys = await q
    .selectFrom('org_provider_key')
    .distinctOn('provider')
    .select(['provider', 'seq'])
    .where('org_id', '=', org)
    .orderBy('provider')
    .orderBy('seq', 'desc')
    .execute();
  const revision = new Map(keys.map((k) => [k.provider, k.seq]));
  return rows.map((row) => {
    const keyRevision = revision.get(row.provider) ?? null;
    return {
      provider: row.provider,
      adapter: row.adapter,
      baseUrl: row.base_url,
      seq: row.seq,
      hasKey: keyRevision !== null,
      keyRevision,
    };
  });
}
