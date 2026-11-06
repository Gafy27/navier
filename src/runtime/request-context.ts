import { appError, err, ErrorCode, ok, parseJsonObject } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';

export { JsonValueSchema } from '../index.ts';
export type { JsonValue } from '../index.ts';

/** A plain JSON object: the request context of one turn. */
export type RequestContext = Record<string, unknown>;

/** The identity keys every turn start writes; tools read them; the wire must not set them. */
export const PRINCIPAL_ID_KEY = 'sdk__principalId';
export const ORG_ID_KEY = 'sdk__orgId';

const REQUEST_CONTEXT_SUBJECT = 'requestContext';

const IDENTITY_KEYS = [PRINCIPAL_ID_KEY, ORG_ID_KEY] as const;

/** A copy of a plain JSON object. `invalid_argument` names the first bad path (`a.b[2]`), never a value. */
export function parseRequestContext(raw: unknown): Result<RequestContext> {
  return parseJsonObject(raw, REQUEST_CONTEXT_SUBJECT);
}

/**
 * Caller-supplied context plus org and principal from auth. A body value under
 * an identity key is refused, not overwritten.
 */
export function turnRequestContext(
  raw: unknown,
  principalId: string,
  org: OrgId,
): Result<RequestContext> {
  const context = parseRequestContext(raw);
  if (!context.ok) return context;
  for (const key of IDENTITY_KEYS) {
    if (Object.hasOwn(context.value, key)) {
      return err(
        appError(ErrorCode.invalid_argument, `requestContext.${key}: reserved`),
      );
    }
  }
  return ok({
    ...context.value,
    [PRINCIPAL_ID_KEY]: principalId,
    [ORG_ID_KEY]: org,
  });
}
