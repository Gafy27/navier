import { appError, err, ErrorCode, ok, requirePageLimit, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { AuthzObjectType, authzObject, DenyReason } from '../identity/index.ts';
import type { AuthzAdmin, Caller } from '../identity/index.ts';
import { listThreadIds } from '../runtime/index.ts';
import { apiInternal, apiNotFound, apiUnavailable } from './adapter/errors.ts';

/** The authz-api actions on a conversation (D1). `authzObject` owns the closed set of types. */
export const ConversationAction = z.enum({
  can_read: 'can_read',
  can_post: 'can_post',
});
export type ConversationAction = z.infer<typeof ConversationAction>;

/** L3: `not_visible` is `not_found`, so a hidden conversation reads as a missing one (G5). */
const denial = (reason: DenyReason) => {
  switch (reason) {
    case DenyReason.not_visible:
      return apiNotFound;
    case DenyReason.no_grant:
      return appError(ErrorCode.permission_denied, 'forbidden');
    case DenyReason.unavailable:
      return apiUnavailable;
    default:
      return apiInternal;
  }
};

type ObjectChecker = Pick<AuthzAdmin, 'checkObjects'>;

/** PD1: `ok` when the caller holds `action` on conversation `threadId`. A deny is a store code, never a body. */
export async function requireConversation(
  admin: ObjectChecker,
  caller: Caller,
  org: OrgId,
  threadId: string,
  action: ConversationAction,
): Promise<Result<void>> {
  const decided = await admin.checkObjects(caller, org, [
    {
      object: authzObject(org, AuthzObjectType.conversation, threadId),
      action,
    },
  ]);
  if (!decided.ok) return decided;
  const [decision] = decided.value;
  if (decision === undefined) return err(apiInternal);
  return decision.allow ? ok(undefined) : err(denial(decision.reason));
}

export interface ReadablePage {
  readonly items: string[];
  readonly after?: string;
}

/**
 * L3: up to `limit` conversation ids the caller can read, in id order after
 * `after`. The check filters before the limit. The cursor is the last candidate
 * examined, absent when none was.
 */
export async function listReadable(
  admin: ObjectChecker,
  db: Db,
  caller: Caller,
  org: OrgId,
  page: { readonly limit: number; readonly after?: string },
): Promise<Result<ReadablePage>> {
  const { limit } = page;
  const limitOk = requirePageLimit(limit);
  if (!limitOk.ok) return limitOk;
  const items: string[] = [];
  let cursor = page.after;
  let examined: string | undefined;
  for (;;) {
    const candidates = await listThreadIds(db, org, {
      chunk: limit,
      ...(cursor === undefined ? {} : { after: cursor }),
    });
    if (candidates.length === 0) {
      return ok(
        examined === undefined ? { items } : { items, after: examined },
      );
    }
    const decided = await admin.checkObjects(
      caller,
      org,
      candidates.map((id) => ({
        object: authzObject(org, AuthzObjectType.conversation, id),
        action: ConversationAction.enum.can_read,
      })),
    );
    if (!decided.ok) return decided;
    for (const [i, id] of candidates.entries()) {
      examined = id;
      const decision = decided.value[i];
      if (decision === undefined) return err(apiInternal);
      if (!decision.allow) {
        if (decision.reason === DenyReason.unavailable) {
          return err(apiUnavailable);
        }
        continue;
      }
      items.push(id);
      if (items.length === limit) return ok({ items, after: examined });
    }
    cursor = examined;
  }
}
