import type { Logger, Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import type { TerminalStatus } from './status.ts';
import type {
  LoadedTurn,
  RunnableAction,
  ToolCallOutcome,
} from './workflow-types.ts';

/**
 * The step contract both runners call (P2.2 PD4). A leaf: type-only imports of
 * shared types and runtime leaves, so `src/runner` imports it without a cycle.
 */

/** Who numbers the attempt: the caller's runner, or runtime from the status rows (D4). */
export const STORED_ATTEMPT = 'stored' as const;
export type StepAttempt = number | typeof STORED_ATTEMPT;

export interface LoadTurnArgs {
  readonly org: OrgId;
  readonly agentMessageId: string;
}

/** A model step's ids and attempt. The abort signal travels beside it. */
export interface ModelStepArgs {
  readonly org: OrgId;
  readonly messageId: string;
  readonly stepIndex: number;
  readonly runKey: string;
  /** A runner's own attempt from 1, or `stored` when no step guard reads it (PD2). */
  readonly attempt: StepAttempt;
  /** Receives the one `stream_cap` warning (PD7). */
  readonly log: Logger;
}

export interface ModelStepResult {
  readonly runnable: readonly RunnableAction[];
  readonly done: boolean;
  /** An action of the step is blocked: the run pauses. */
  readonly waiting: boolean;
}

/** A tool call's ids and attempt. The abort signal travels beside it. */
export interface ToolCallArgs {
  readonly org: OrgId;
  readonly actionId: string;
  /** A runner's own attempt from 1, or `stored`: runtime derives it from the status rows (PD2). */
  readonly attempt: StepAttempt;
}

export interface FailActionArgs {
  readonly org: OrgId;
  readonly actionId: string;
  readonly reason: string;
}

export interface PauseArgs {
  readonly org: OrgId;
  readonly agentMessageId: string;
}

/** What `pauseTurn` armed: the seconds before the pause expires. */
export interface PausedTurn {
  readonly seconds: number;
}

export interface FinishArgs {
  readonly org: OrgId;
  readonly agentMessageId: string;
  readonly status: TerminalStatus;
  readonly reason: string | null;
}

/** What `closeTurn` returns: the agent message promotion minted, if any. */
export interface ClosedTurn {
  readonly promotedAgentMessageId: string | undefined;
}

/**
 * The domain step bodies both runners call (P1.1 D2). Plain async functions
 * over ids; every expected failure is a `Result` (PD1), so a runner maps
 * `unavailable` and `aborted` to retry and the rest to no-retry.
 */
export interface TurnSteps {
  loadTurn(args: LoadTurnArgs): Promise<Result<LoadedTurn>>;
  modelStep(
    args: ModelStepArgs,
    signal: AbortSignal,
  ): Promise<Result<ModelStepResult>>;
  toolCall(
    args: ToolCallArgs,
    signal: AbortSignal,
  ): Promise<Result<ToolCallOutcome>>;
  failAction(args: FailActionArgs): Promise<Result<void>>;
  pauseTurn(args: PauseArgs): Promise<Result<PausedTurn>>;
  finishTurn(args: FinishArgs): Promise<Result<ClosedTurn>>;
}
