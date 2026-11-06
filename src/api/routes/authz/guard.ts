import { appError, err, ErrorCode, ok } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import type { OrgId } from '../../../db/index.ts';
import type { ObjectRef } from '../../../identity/index.ts';
import { apiNotFound } from '../../adapter/errors.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import { DirectoryType, ORG_ID_SEPARATOR } from './directory.ts';

/** The prefix of a person grantee. It names no org and passes (L1). */
const USER_PREFIX = 'user:';
const TYPE_MARK = ':';
const RELATION_MARK = '#';

const INVALID_OBJECT = appError(ErrorCode.invalid_argument, 'invalid object');

/** The string form of an object, as `requireSameOrg` reads it. */
export const refOf = (object: ObjectRef): string =>
  `${object.type}${TYPE_MARK}${object.id}`;

/** Reads `<type>:<id>`, the form a body or query names an object in. */
export function parseObject(raw: string): Result<ObjectRef, ApiFailure> {
  const at = raw.indexOf(TYPE_MARK);
  if (at <= 0 || at === raw.length - 1) return err(INVALID_OBJECT);
  return ok({ type: raw.slice(0, at), id: raw.slice(at + 1) });
}

/** The org a ref names: `organization:<org>` or `<type>:<org>~<id>`, each with an optional `#<rel>`. */
function orgOfRef(ref: string): string | undefined {
  const at = ref.indexOf(TYPE_MARK);
  if (at <= 0) return undefined;
  const type = ref.slice(0, at);
  const [id = '', ...relation] = ref.slice(at + 1).split(RELATION_MARK);
  if (relation.length > 1 || relation[0] === '') return undefined;
  if (type === DirectoryType.enum.organization) {
    return id.includes(ORG_ID_SEPARATOR) ? undefined : id;
  }
  const mark = id.indexOf(ORG_ID_SEPARATOR);
  return mark <= 0 || mark === id.length - 1 ? undefined : id.slice(0, mark);
}

/** L2 (PD3): every object and grantee is in `org`, or the call is `not_found` before any RPC. */
export function requireSameOrg(
  org: OrgId,
  refs: readonly string[],
): Result<void> {
  for (const ref of refs) {
    if (ref.startsWith(USER_PREFIX)) continue;
    if (orgOfRef(ref) !== org) return err(apiNotFound);
  }
  return ok(undefined);
}
