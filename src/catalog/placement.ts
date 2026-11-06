import { appError, err, ErrorCode, z } from '../index.ts';
import type { Result } from '../index.ts';
import { withTransaction } from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { registerTool, ToolEntryInputSchema } from './catalog.ts';
import type { ToolEntry } from './catalog.ts';
import type { CatalogConfig } from './config.ts';

export interface CreateToolDeps {
  readonly db: Db;
  readonly authz: Authz;
  readonly config: CatalogConfig;
}

export interface SpaceChange {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

/** Only the key: the full entry is checked by `registerTool` after the RPC (PD4). */
const KeyOnlySchema = z.object({ key: ToolEntryInputSchema.shape.key });

/**
 * PD4: `RegisterTool` first, then the catalog row. A denial writes no row. A retry
 * after a crash between the two repeats the RPC (same-owner `ok`) and writes the row.
 */
export async function createTool(
  deps: CreateToolDeps,
  caller: Caller,
  org: OrgId,
  input: unknown,
): Promise<Result<ToolEntry>> {
  const named = KeyOnlySchema.safeParse(input);
  if (!named.success) {
    return err(appError(ErrorCode.invalid_argument, 'invalid tool entry: key'));
  }
  const registered = await deps.authz.registerTool(caller, org, named.data.key);
  if (!registered.ok) return registered;
  return withTransaction(deps.db, (tx) =>
    registerTool(tx, deps.config, org, input, caller.principal),
  );
}

/** One `WriteToolSpaces` with the delta. An empty delta is refused before the RPC (G3). */
export async function moveToolSpaces(
  authz: Authz,
  caller: Caller,
  org: OrgId,
  key: string,
  change: SpaceChange,
): Promise<Result<void>> {
  if (change.add.length + change.remove.length === 0) {
    return err(appError(ErrorCode.invalid_argument, 'spaces: empty change'));
  }
  return authz.writeToolSpaces(caller, org, key, change);
}
