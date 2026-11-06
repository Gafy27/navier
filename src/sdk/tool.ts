import { z } from '../index.ts';
import type { JsonValue } from '../index.ts';
import { ToolEntryInputSchema } from '../catalog/index.ts';
import type { ToolEntryInput } from '../catalog/index.ts';
import type {
  Blocked,
  ToolContext,
  ToolImplementation,
} from '../runtime/index.ts';
import { invalidArgument } from './errors.ts';
import { RequestContext } from './request-context.ts';

/** Stored approval levels. `requireApproval` picks one of the two ends (D2). */
const APPROVAL = { never: 'never_ask', always: 'high' } as const;

/** The catalog entry fields, named as the author wrote them. */
const CONFIG_FIELD: Readonly<Record<string, string>> = {
  key: 'id',
  implementationVersion: 'version',
  toolAttempts: 'retry.attempts',
  retryOnInterrupt: 'retry',
};

const INPUT_SCHEMA_FIELD = 'inputSchema';
const APPROVAL_FIELD = 'requireApproval';
const INPUT_FIELD = 'input';
const OUTPUT_FIELD = 'outputSchema';

export interface ToolExecutionContext extends Pick<
  ToolContext,
  | 'abortSignal'
  | 'resumePointer'
  | 'saveResumePointer'
  | 'block'
  | 'blockPointer'
> {
  readonly requestContext: RequestContext;
  readonly agent: {
    readonly agentId: string;
    readonly threadId: string;
    readonly messageId: string;
    readonly toolCallId: string;
  };
}

export interface ToolConfig<I, O extends JsonValue = JsonValue> {
  readonly id: string;
  readonly version: number;
  readonly description: string;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema?: z.ZodType<O>;
  readonly maxToolOutputBytes?: number;
  readonly requireApproval?: boolean;
  readonly retry?: { readonly onInterrupt: true; readonly attempts: number };
  execute(input: I, ctx: ToolExecutionContext): Promise<O | Blocked>;
}

export type Tool<I = unknown, O extends JsonValue = JsonValue> = Readonly<
  ToolConfig<I, O>
>;
function containsRef(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRef);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([name, child]) => name === '$ref' || containsRef(child),
  );
}

function storedInputSchema(schema: z.ZodType): Record<string, unknown> {
  let json: Record<string, unknown>;
  try {
    json = z.toJSONSchema(schema, { target: 'draft-7', io: 'input' });
  } catch {
    throw invalidArgument(INPUT_SCHEMA_FIELD, 'cannot be converted');
  }
  if (json['type'] !== 'object') {
    throw invalidArgument(INPUT_SCHEMA_FIELD, 'must be an object schema');
  }
  if (containsRef(json)) throw invalidArgument(INPUT_SCHEMA_FIELD, 'has $ref');
  return json;
}

function approvalOf(requireApproval: unknown): ToolEntryInput['approval'] {
  if (requireApproval === undefined || requireApproval === false) {
    return APPROVAL.never;
  }
  if (requireApproval === true) return APPROVAL.always;
  throw invalidArgument(APPROVAL_FIELD, 'must be a boolean');
}

/** The P3.2 entry. A cap or retry field the author left out stays out. */
export function toToolEntryInput(tool: Tool): ToolEntryInput {
  return {
    key: tool.id,
    implementationVersion: tool.version,
    name: tool.id,
    description: tool.description,
    inputSchema: storedInputSchema(tool.inputSchema),
    approval: approvalOf(tool.requireApproval),
    configSchema: null,
    ...(tool.maxToolOutputBytes === undefined
      ? {}
      : { maxToolOutputBytes: tool.maxToolOutputBytes }),
    ...(tool.retry === undefined
      ? {}
      : { retryOnInterrupt: true, toolAttempts: tool.retry.attempts }),
  };
}

/** Checks `config` and returns it frozen. Throws `SdkError` `invalid_argument` naming the first bad field. */
export function createTool<I, O extends JsonValue = JsonValue>(
  config: ToolConfig<I, O>,
): Tool<I, O> {
  const entry = ToolEntryInputSchema.safeParse(toToolEntryInput(config));
  if (!entry.success) {
    const field = String(entry.error.issues[0]?.path[0]);
    throw invalidArgument(CONFIG_FIELD[field] ?? field, 'invalid');
  }
  return Object.freeze({ ...config });
}

function issuePaths(error: z.ZodError): string {
  return [...new Set(error.issues.map((i) => i.path.join('.') || '(root)'))]
    .sort()
    .join(', ');
}

/** The P4.3 implementation: Zod parses the input and the output around `execute`. */
export function toImplementation(tool: Tool): ToolImplementation {
  return {
    key: tool.id,
    implementationVersion: tool.version,
    execute: async (rawInput, ctx) => {
      const input = tool.inputSchema.safeParse(rawInput);
      if (!input.success) {
        throw invalidArgument(INPUT_FIELD, issuePaths(input.error));
      }
      let blockToken: Blocked | undefined;
      const result = await tool.execute(input.data, {
        requestContext: new RequestContext(ctx.requestContext),
        abortSignal: ctx.abortSignal,
        agent: {
          agentId: ctx.ids.agentId,
          threadId: ctx.ids.threadId,
          messageId: ctx.ids.agentMessageId,
          toolCallId: ctx.ids.actionId,
        },
        resumePointer: ctx.resumePointer,
        saveResumePointer: ctx.saveResumePointer,
        block: (kind, pointer) => {
          blockToken = ctx.block(kind, pointer);
          return blockToken;
        },
        blockPointer: ctx.blockPointer,
      });
      if (result === blockToken || tool.outputSchema === undefined) {
        return result;
      }
      const output = tool.outputSchema.safeParse(result);
      if (!output.success) {
        throw invalidArgument(OUTPUT_FIELD, issuePaths(output.error));
      }
      return output.data;
    },
  };
}
