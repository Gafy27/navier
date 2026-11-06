import { appendIfNewest, withTables } from '../db/index.ts';
import type { OrgId, Tx } from '../db/index.ts';
import { ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { BlockKind } from './status.ts';
import type { RuntimeTables } from './tables.ts';

/** The closed set of action statuses. */
export const ActionStatus = {
  created: 'created',
  running: 'running',
  succeeded: 'succeeded',
  errored: 'errored',
  cancelled: 'cancelled',
  blocked: 'blocked',
} as const;

export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

export interface ActionStatusRow {
  readonly status: ActionStatus;
  readonly reason: string | null;
  readonly attempt: number | null;
  /** A JSON value; `null` stores no pointer. */
  readonly resumePointer: unknown;
  readonly blockKind?: BlockKind | null;
  /** A JSON value; `null` stores no pointer. */
  readonly blockPointer?: unknown;
}

/**
 * Appends `row` at the newest `seq` plus one when `accept` allows the newest
 * status (`undefined` when the action has none) and its attempt. A refusal or lost race is `aborted`.
 */
export async function appendActionStatus(
  tx: Tx,
  org: OrgId,
  actionId: string,
  accept: (newest: string | undefined, newestAttempt: number | null) => boolean,
  row: ActionStatusRow,
): Promise<Result<void>> {
  const appended = await appendIfNewest<RuntimeTables, 'action_status'>(
    withTables<RuntimeTables>(tx),
    {
      table: 'action_status',
      org,
      key: { action_id: actionId },
      accept: (newest) => accept(newest?.status, newest?.attempt ?? null),
      row: () => ({
        action_id: actionId,
        status: row.status,
        reason: row.reason,
        attempt: row.attempt,
        resume_pointer:
          row.resumePointer === null ? null : JSON.stringify(row.resumePointer),
        block_kind: row.blockKind ?? null,
        block_pointer:
          row.blockPointer == null ? null : JSON.stringify(row.blockPointer),
      }),
    },
  );
  return appended.ok ? ok(undefined) : appended;
}
