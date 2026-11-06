import { jsonSchema, streamText, tool } from 'ai';
import type {
  JSONSchema7,
  JSONValue,
  LanguageModel,
  ModelMessage as SdkMessage,
  ToolSet,
} from 'ai';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { mapProviderError } from '../errors.ts';
import { decodeToolName, encodeToolName } from '../tool-names.ts';
import { ProviderDataSchema } from '../types.ts';
import type {
  FinishReason,
  ModelChunk,
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelToolSpec,
  ProviderData,
} from '../types.ts';

const FINISH_REASONS: Readonly<Record<string, FinishReason>> = {
  stop: 'stop',
  'tool-calls': 'tool_calls',
  length: 'length',
  'content-filter': 'content_filter',
};

/** Provider options for one `streamText` call. Absent when the request sets no effort. */
export type EffortOptions = Record<string, Record<string, JSONValue>>;

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

function toSdkMessage(message: ModelMessage): SdkMessage {
  switch (message.role) {
    case 'user':
      return { role: 'user', content: message.text };
    case 'assistant':
      return {
        role: 'assistant',
        content: [
          ...message.reasoning.map((block) => ({
            type: 'reasoning' as const,
            text: block.text,
            providerOptions: block.providerData as Record<
              string,
              Record<string, JSONValue>
            >,
          })),
          ...(message.text === ''
            ? []
            : [{ type: 'text' as const, text: message.text }]),
          ...message.toolCalls.map((call) => ({
            type: 'tool-call' as const,
            toolCallId: call.id,
            toolName: encodeToolName(call.name),
            input: call.input,
          })),
        ],
      };
    case 'tool':
      return {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.toolCallId,
            toolName: encodeToolName(message.name),
            output: {
              type: message.isError ? 'error-text' : 'text',
              value: message.output,
            },
          },
        ],
      };
  }
}

function toSdkTools(
  specs: readonly ModelToolSpec[],
  toolNameMax: number,
): Result<ToolSet> {
  const tools: ToolSet = {};
  for (const spec of specs) {
    const name = encodeToolName(spec.name);
    if (name.length > toolNameMax) {
      return invalid(`tool ${spec.name}: name too long for the provider`);
    }
    tools[name] = tool({
      description: spec.description,
      inputSchema: jsonSchema(spec.inputSchema as JSONSchema7),
    });
  }
  return ok(tools);
}

function providerData(metadata: unknown): Result<ProviderData> {
  if (metadata === undefined) return ok({});
  let normalized: unknown = metadata;
  try {
    normalized = JSON.parse(JSON.stringify(metadata));
  } catch {
    return ok({});
  }
  const parsed = ProviderDataSchema.safeParse(normalized);
  return parsed.success ? ok(parsed.data) : ok({});
}

/** The response mapping needs the request's keys to decode names. */
function decoder(request: ModelRequest): (name: string) => string {
  const keys = new Set(request.tools.map((t) => t.name));
  return (name) => {
    const decoded = decodeToolName(name);
    return decoded !== undefined && keys.has(decoded) ? decoded : name;
  };
}

/**
 * One `streamText` call with the SDK retries off, read to its end. The provider
 * supplies the model and how `reasoningEffort` becomes provider options.
 * `onChunk` sees text and reasoning deltas; a throw from it ends the callbacks,
 * not the call.
 */
export function createProviderGenerate(spec: {
  readonly model: (modelId: string) => LanguageModel;
  readonly toolNameMax: number;
  readonly effortOptions: (
    effort: string | null,
  ) => Result<EffortOptions | undefined>;
}) {
  return async (
    request: ModelRequest,
    signal: AbortSignal,
    onChunk?: (chunk: ModelChunk) => void | Promise<void>,
  ): Promise<Result<ModelResponse>> => {
    const tools = toSdkTools(request.tools, spec.toolNameMax);
    if (!tools.ok) return tools;
    const options = spec.effortOptions(request.reasoningEffort);
    if (!options.ok) return options;

    let sink = onChunk;
    const publish = async (chunk: ModelChunk) => {
      if (sink === undefined) return;
      try {
        await sink(chunk);
      } catch {
        sink = undefined;
      }
    };

    const raw: unknown[] = [];
    let result;
    let final;
    try {
      result = streamText({
        model: spec.model(request.model),
        system: request.system,
        messages: request.messages.map(toSdkMessage),
        ...(request.tools.length === 0 ? {} : { tools: tools.value }),
        maxRetries: 0,
        abortSignal: signal,
        includeRawChunks: true,
        // The error part is returned as a result; the SDK's default would log the error.
        onError: () => undefined,
        ...(options.value === undefined
          ? {}
          : { providerOptions: options.value }),
      });
      for await (const part of result.stream) {
        if (part.type === 'error') return err(mapProviderError(part.error));
        if (part.type === 'abort') {
          return err(mapProviderError(new DOMException('', 'AbortError')));
        }
        if (part.type === 'raw') raw.push(part.rawValue);
        if (part.type === 'text-delta') {
          await publish({ kind: 'text', text: part.text });
        }
        if (part.type === 'reasoning-delta') {
          await publish({ kind: 'reasoning', text: part.text });
        }
      }
      final = await result.finalStep;
    } catch (e) {
      return err(mapProviderError(e));
    }

    const decode = decoder(request);
    const reasoning = [];
    for (const block of final.reasoning) {
      if (block.type !== 'reasoning') continue;
      const data = providerData(block.providerOptions);
      if (!data.ok) return data;
      reasoning.push({ text: block.text, providerData: data.value });
    }
    return ok({
      text: final.text,
      reasoning,
      toolCalls: final.toolCalls.map((call) => ({
        id: call.toolCallId,
        name: decode(call.toolName),
        input: call.input as unknown,
      })),
      finishReason: FINISH_REASONS[final.finishReason] ?? 'other',
      usage: {
        inputTokens: final.usage.inputTokens ?? 0,
        outputTokens: final.usage.outputTokens ?? 0,
      },
      raw,
    });
  };
}
