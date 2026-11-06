import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';

declare const orgBrand: unique symbol;

/** An org id. It comes only from `parseOrgId`. */
export type OrgId = string & { readonly [orgBrand]: true };

const orgIdPattern = /^[^:#~\s]{1,64}$/u;

/** Accepts 1-64 characters with no `:`, `#`, `~`, or whitespace (authz-api object id rule). */
export function parseOrgId(raw: unknown): Result<OrgId> {
  if (typeof raw !== 'string' || !orgIdPattern.test(raw)) {
    return err(appError(ErrorCode.invalid_argument, 'invalid org id'));
  }
  return ok(raw as OrgId);
}
