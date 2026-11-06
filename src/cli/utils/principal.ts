import { err, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import {
  PRINCIPAL_BAD_ID,
  PRINCIPAL_MAX_ID_LENGTH,
  TOOL_OBJECT_PREFIX,
} from './constants.ts';
import type { AuthKind } from './credentials.ts';
import {
  USAGE_INVALID_SUB,
  USAGE_INVALID_TOOL_KEY,
  USAGE_UNEXPECTED_PRINCIPAL,
} from './copy.ts';
import { CliUsage } from './failure.ts';

type MeResponse = {
  readonly principal: string;
  readonly kind: AuthKind;
};

function badId(id: string): boolean {
  return (
    id === '' ||
    id.length > PRINCIPAL_MAX_ID_LENGTH ||
    PRINCIPAL_BAD_ID.test(id)
  );
}

/** `<kind>:<ns>~<sub>` from the caller's own principal and a grantee `sub` (P13.8 PD5). */
export function builderPrincipal(
  me: MeResponse,
  sub: string,
): Result<string, CliUsage> {
  if (badId(sub)) return err(new CliUsage(USAGE_INVALID_SUB));
  const at = me.principal.indexOf(':');
  const tilde = me.principal.indexOf('~');
  if (at < 1 || tilde < at)
    return err(new CliUsage(USAGE_UNEXPECTED_PRINCIPAL));
  return ok(`${me.principal.slice(0, tilde + 1)}${sub}`);
}

/** `tool:<org>~<key>` for a tool key that passes the same character check. */
export function toolObject(org: string, key: string): Result<string, CliUsage> {
  if (badId(key)) return err(new CliUsage(USAGE_INVALID_TOOL_KEY));
  return ok(`${TOOL_OBJECT_PREFIX}${org}~${key}`);
}
