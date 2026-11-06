import type { JsonValue } from '../index.ts';
import type { BlockKind, MessageStatus } from '../runtime/index.ts';
import type { RequestContext } from './request-context.ts';

/** One tool call that waits on a person. `toolCallId` is the action id a tool sees as `ctx.agent.toolCallId`. */
export interface BlockedToolCall {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: JsonValue;
  readonly kind: BlockKind;
  readonly expiresAt: Date;
}

/** What a turn left in the store. `abandoned` is true when the caller's abort fired before the message ended. */
export interface GenerateResult {
  readonly runId: string;
  readonly status: MessageStatus;
  readonly reason: string | null;
  readonly text: string;
  readonly agentVersion: number;
  readonly traceId: string;
  readonly blockedActions: readonly BlockedToolCall[];
  readonly abandoned: boolean;
}

export interface GenerateOptions {
  readonly runtime: RuntimeSession;
  readonly memory: { readonly thread: string };
  readonly requestContext?: RequestContext | Record<string, JsonValue>;
  readonly maxSteps?: number;
  readonly runId?: string;
  readonly abortSignal?: AbortSignal;
}

/** The turn an approve or decline answers. */
export interface ToolCallTarget {
  readonly runId: string;
  readonly toolCallId: string;
}

export interface DecisionOptions {
  readonly abortSignal?: AbortSignal;
}

export interface GenerateRequest extends Omit<GenerateOptions, 'runtime'> {
  /** The agent's SDK id; the session derives the stored id from its org. */
  readonly agentKey: string;
  readonly input: string;
}

/**
 * A verified caller bound to an org, with the three operations `Agent` calls.
 * Only `createRuntime` builds one. Each operation throws `SdkError`.
 */
export interface RuntimeSession {
  readonly generate: (request: GenerateRequest) => Promise<GenerateResult>;
  readonly approveToolCall: (
    target: ToolCallTarget,
    options: DecisionOptions,
  ) => Promise<GenerateResult>;
  readonly declineToolCall: (
    target: ToolCallTarget,
    options: DecisionOptions,
  ) => Promise<GenerateResult>;
}
