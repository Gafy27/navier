/** The closed set of message statuses. */
export const MessageStatus = {
  created: 'created',
  paused: 'paused',
  succeeded: 'succeeded',
  errored: 'errored',
  cancelled: 'cancelled',
  interrupted: 'interrupted',
  gracefully_stopped: 'gracefully_stopped',
  max_steps: 'max_steps',
  expired: 'expired',
} as const;

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export type TerminalStatus = Exclude<MessageStatus, 'created' | 'paused'>;

/** Every status but `created` and `paused`. Derived so a new status cannot be left off. */
export const TERMINAL_STATUSES: readonly TerminalStatus[] = Object.values(
  MessageStatus,
).filter(
  (status): status is TerminalStatus =>
    status !== MessageStatus.created && status !== MessageStatus.paused,
);

/** The kind of block on an action. */
export const BlockKind = {
  approval: 'approval',
  authentication: 'authentication',
  retry: 'retry',
} as const;

export type BlockKind = (typeof BlockKind)[keyof typeof BlockKind];

/** What the reaper did with one claim (P4.5 D3). */
export const RecoveryOutcome = {
  restarted: 'restarted',
  stopped: 'stopped',
  gave_up: 'gave_up',
} as const;

export type RecoveryOutcome =
  (typeof RecoveryOutcome)[keyof typeof RecoveryOutcome];
