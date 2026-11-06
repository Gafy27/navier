import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { ConfigError } from '../config.ts';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import type { TurnRunner } from './types.ts';

function csvOrgIds(raw: string, ctx: z.RefinementCtx): OrgId[] {
  const orgs: OrgId[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id === '') continue;
    const parsed = parseOrgId(id);
    if (parsed.ok) orgs.push(parsed.value);
    else ctx.addIssue({ code: 'custom', message: 'invalid org id' });
  }
  return orgs;
}

export const RunnerConfigSchema = z.object({
  RUNNER_DEFAULT: z.enum(['dbos', 'temporal']).default('dbos'),
  RUNNER_TEMPORAL_ORGS: z.string().default('').transform(csvOrgIds),
  DBOS_SYSTEM_DATABASE_URL: z.string().optional(),
  DBOS_APP_VERSION: z.string().min(1),
  DBOS_EXECUTOR_ID: z.string().optional(),
});

export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;

function dbKey(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.hostname === '') return undefined;
    return [u.hostname.toLowerCase(), u.port || '5432', u.pathname].join('|');
  } catch {
    return undefined;
  }
}

export function sameDatabase(a: string, b: string): boolean {
  const left = dbKey(a);
  return left !== undefined && left === dbKey(b);
}

export function checkSystemDatabase(
  config: Pick<RunnerConfig, 'DBOS_SYSTEM_DATABASE_URL'>,
  databaseUrl: string,
): Result<void, ConfigError> {
  const url = config.DBOS_SYSTEM_DATABASE_URL;
  if (url === undefined || sameDatabase(url, databaseUrl)) return ok(undefined);
  return err(
    appError(
      ErrorCode.invalid_argument,
      'invalid configuration: DBOS_SYSTEM_DATABASE_URL (differs from DATABASE_URL)',
    ) as ConfigError,
  );
}

export function startOn(
  config: Pick<RunnerConfig, 'RUNNER_DEFAULT' | 'RUNNER_TEMPORAL_ORGS'>,
): (org: OrgId) => TurnRunner['name'] {
  const { RUNNER_DEFAULT, RUNNER_TEMPORAL_ORGS: listed } = config;
  return (org) => (listed.includes(org) ? 'temporal' : RUNNER_DEFAULT);
}
