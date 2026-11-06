import type { TerminalStatus } from './status.ts';

/** Service limits the starter snapshots from config. The workflow reads no config. */
export interface ServiceLimits {
  readonly modelCallTimeoutMs: number;
  readonly modelAttempts: number;
  readonly toolCallTimeoutMs: number;
  readonly storeCallTimeoutMs: number;
  readonly maxHistoryLength?: number;
}

/** Ids plus service limits. No request context, text, arguments, or outputs (D3). */
export interface TurnWorkflowInput {
  readonly org: string;
  readonly threadId: string;
  readonly agentMessageId: string;
  readonly service: ServiceLimits;
}

export interface RunnableAction {
  readonly actionId: string;
  readonly attempts: number;
}

export type LoadedTurn =
  | { readonly kind: 'finished' }
  | {
      readonly kind: 'run';
      readonly nextStep: number;
      readonly pending: readonly RunnableAction[];
      readonly maxSteps: number;
      readonly toolCallConcurrency: number;
      /** A history recorded before P5.2 has no such field. */
      readonly waiting?: boolean;
    };

export interface ModelStepOutcome {
  readonly runnable: readonly RunnableAction[];
  readonly done: boolean;
  /** A history recorded before P5.2 has no such field. */
  readonly waiting?: boolean;
}

export type ToolCallOutcome =
  { readonly kind: 'done' } | { readonly kind: 'blocked' };

/** The activities the workflow calls. Ids and small values in and out. */
export interface TurnActivities {
  loadTurn: (args: {
    org: string;
    agentMessageId: string;
  }) => Promise<LoadedTurn>;
  modelStep: (args: {
    org: string;
    agentMessageId: string;
    stepIndex: number;
    runKey: string;
  }) => Promise<ModelStepOutcome>;
  toolCall: (args: {
    org: string;
    actionId: string;
  }) => Promise<ToolCallOutcome>;
  failAction: (args: {
    org: string;
    actionId: string;
    reason: string;
  }) => Promise<void>;
  pauseTurn: (args: { org: string; agentMessageId: string }) => Promise<void>;
  finishTurn: (args: {
    org: string;
    agentMessageId: string;
    status: TerminalStatus;
    reason: string | null;
  }) => Promise<void>;
}

/** What the reaper schedule starts the sweep workflow with (P4.5 D1). */
export interface ReaperWorkflowInput {
  readonly storeCallTimeoutMs: number;
  readonly sweepTimeoutMs: number;
}

/** The one activity of the reaper workflow. */
export interface ReaperActivities {
  sweep: (args: { storeCallTimeoutMs: number }) => Promise<void>;
}

/** What the stream-sweep schedule starts the workflow with (D3). */
export interface StreamSweepWorkflowInput {
  readonly sweepTimeoutMs: number;
}

/** The one activity of the stream-sweep workflow. */
export interface StreamSweepActivities {
  sweepStreamDeltas: () => Promise<void>;
}
