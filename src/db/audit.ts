import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { hasPgCode } from './db.ts';
import type { Db, Tx } from './db.ts';
import type { OrgId } from './org.ts';

/** What happened, who did it, to what. There is no place for a value. */
export interface AuditEvent {
  readonly kind: string;
  readonly actor: { readonly kind: string; readonly id: string };
  readonly target: { readonly kind: string; readonly id: string };
  readonly traceId?: string;
}

export interface AuditRecord extends AuditEvent {
  readonly id: string;
  readonly at: Date;
}

const CHECK_VIOLATION = '23514';

/** Writes one audit row in the caller's transaction. A malformed kind is `invalid_argument`. */
export async function writeAudit(
  tx: Tx,
  org: OrgId,
  event: AuditEvent,
): Promise<Result<void>> {
  try {
    await tx
      .insertInto('audit_event')
      .values({
        org_id: org,
        kind: event.kind,
        actor_kind: event.actor.kind,
        actor_id: event.actor.id,
        target_kind: event.target.kind,
        target_id: event.target.id,
        trace_id: event.traceId ?? null,
      })
      .execute();
    return ok(undefined);
  } catch (e) {
    if (hasPgCode(e, CHECK_VIOLATION)) {
      return err(appError(ErrorCode.invalid_argument, 'invalid audit kind'));
    }
    throw e;
  }
}

/** Returns at most `limit` of the org's events after the id `after`, in id order. */
export async function listAudit(
  db: Db | Tx,
  org: OrgId,
  limit: number,
  after?: string,
): Promise<Result<AuditRecord[]>> {
  if (!Number.isInteger(limit) || limit < 1) {
    return err(appError(ErrorCode.invalid_argument, 'invalid limit'));
  }
  if (after !== undefined && !/^\d+$/.test(after)) {
    return err(appError(ErrorCode.invalid_argument, 'invalid after id'));
  }
  let query = db
    .selectFrom('audit_event')
    .selectAll()
    .where('org_id', '=', org)
    .orderBy('id')
    .limit(limit);
  if (after !== undefined) query = query.where('id', '>', after);
  const rows = await query.execute();
  return ok(
    rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      actor: { kind: r.actor_kind, id: r.actor_id },
      target: { kind: r.target_kind, id: r.target_id },
      ...(r.trace_id === null ? {} : { traceId: r.trace_id }),
      at: r.at,
    })),
  );
}
