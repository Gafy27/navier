import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import { DenyReason, formatScope } from '../identity/index.ts';
import type { Authz, Caller, Scope } from '../identity/index.ts';

const invoke = (toolKey: string): Scope => ({
  resource: 'tool',
  action: 'invoke',
  id: toolKey,
});

export const invokeScope = (toolKey: string): string =>
  formatScope(invoke(toolKey));

/**
 * L3 edge layer: the caller's `tool:invoke` on every key, one `checkMany`.
 * The first deny, in the version's order, is `permission_denied`.
 */
export async function requireToolInvoke(
  authz: Authz,
  org: OrgId,
  caller: Caller,
  toolKeys: readonly string[],
): Promise<Result<void>> {
  const keys = [...new Set(toolKeys)];
  if (keys.length === 0) return ok(undefined);
  const decisions = await authz.checkMany(org, caller, keys.map(invoke));
  if (!decisions.ok) return decisions;
  const answers = keys.map((_, i) => decisions.value[i]);
  // A missing decision is not an answer: fail closed as unavailable.
  const unavailable = answers.some(
    (d) => d === undefined || (!d.allow && d.reason === DenyReason.unavailable),
  );
  if (unavailable) {
    return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
  }
  const denied = keys.find((_, i) => answers[i]?.allow !== true);
  if (denied === undefined) return ok(undefined);
  return err(
    appError(ErrorCode.permission_denied, `missing ${invokeScope(denied)}`),
  );
}
