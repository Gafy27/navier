import type { OrgId } from '../../db/index.ts';

/** The only place the turn queue name is spelled (PD4). */
export const TURN_QUEUE = 'turns';

/** Sole producer of the enqueue partition key (PD4). One running turn per thread (D2). */
export function partitionKey(org: OrgId, threadId: string): string {
  return `${org}~${threadId}`;
}

export interface TurnQueueOptions {
  readonly workerConcurrency: number;
  readonly partitionConcurrency: 1;
  readonly onConflict: 'update_if_latest_version';
}
