import type { Result } from '../index.ts';
import { z } from '../index.ts';

/** Provider-specific data kept beside a reasoning block, so the next step can send it back. */
export const ProviderDataSchema = z.record(z.string(), z.json());

export type ProviderData = z.infer<typeof ProviderDataSchema>;

/** `name` is the catalog key. */
export interface ModelToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface ModelReasoning {
  readonly text: string;
  readonly providerData: ProviderData;
}

export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export type ModelMessage =
  | { readonly role: 'user'; readonly text: string }
  | {
      readonly role: 'assistant';
      readonly text: string;
      readonly reasoning: readonly ModelReasoning[];
      readonly toolCalls: readonly ModelToolCall[];
    }
  | {
      readonly role: 'tool';
      readonly toolCallId: string;
      readonly name: string;
      readonly output: string;
      readonly isError: boolean;
    };

export interface ModelRequest {
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort: string | null;
  readonly system: string;
  readonly messages: readonly ModelMessage[];
  readonly tools: readonly ModelToolSpec[];
}

export type FinishReason =
  'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other';

export interface ModelResponse {
  readonly text: string;
  readonly reasoning: readonly ModelReasoning[];
  readonly toolCalls: readonly ModelToolCall[];
  readonly finishReason: FinishReason;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  /** The provider's stream events (each raw chunk's value), never its headers. */
  readonly raw: unknown;
}

/** One delta of the model's output, in the order the provider sent it. */
export interface ModelChunk {
  readonly kind: 'text' | 'reasoning';
  readonly text: string;
}

/** What one call needs. The caller holds it for that call only. */
export interface ModelCredentials {
  readonly adapter: string;
  readonly baseUrl: string;
  readonly apiKey: string;
}

export interface ModelAdapter {
  generate(
    request: ModelRequest,
    credentials: ModelCredentials,
    signal: AbortSignal,
    onChunk?: (chunk: ModelChunk) => void | Promise<void>,
  ): Promise<Result<ModelResponse>>;
}
