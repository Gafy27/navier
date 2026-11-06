import { AgentDocumentSchema } from '../agents/index.ts';
import type { AgentDocument } from '../agents/index.ts';
import { z } from '../index.ts';
import { invalidArgument } from './errors.ts';
import type {
  DecisionOptions,
  GenerateOptions,
  GenerateResult,
  RuntimeSession,
  ToolCallTarget,
} from './session.ts';
import type { Tool } from './tool.ts';

/** `'provider/model'` is split at the first separator. */
const MODEL_SEPARATOR = '/';
/** The only scope v1 can start (D5). */
const WorkingMemoryScope = z.enum({ thread: 'thread' });

interface ModelFields {
  readonly model: string;
  readonly reasoningEffort: string | null;
}

export interface AgentConfig {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly instructions: string;
  readonly model: string;
  readonly reasoningEffort: string | null;
  readonly fallbacks?: readonly ModelFields[];
  readonly tools?: Readonly<Record<string, Tool>>;
  readonly memory: {
    readonly lastMessages: number;
    readonly workingMemory: {
      readonly scope: z.infer<typeof WorkingMemoryScope>;
    };
  };
  readonly limits: {
    readonly maxSteps: number;
    readonly pauseTimeout: string;
    readonly maxTraceOutputBytes?: number;
    readonly toolCallConcurrency?: number;
    readonly maxToolCallsPerStep?: number;
    readonly maxRecoveries?: number;
  };
}

interface Built {
  readonly document: AgentDocument;
  readonly tools: readonly Tool[];
}

const built = new WeakMap<Agent, Built>();

function modelChoice(path: string, fields: ModelFields) {
  const { model } = fields;
  if (typeof model !== 'string') throw invalidArgument(path, 'not a string');
  const at = model.indexOf(MODEL_SEPARATOR);
  if (at < 1 || at === model.length - 1) {
    throw invalidArgument(path, 'not provider/model');
  }
  return {
    provider: model.slice(0, at),
    model: model.slice(at + MODEL_SEPARATOR.length),
    reasoningEffort: fields.reasoningEffort,
  };
}

function listedTools(tools: Readonly<Record<string, Tool>> | undefined): {
  readonly refs: AgentDocument['tools'];
  readonly ordered: readonly Tool[];
} {
  const refs: AgentDocument['tools'] = [];
  const ordered: Tool[] = [];
  const seen = new Set<string>();
  for (const [name, tool] of Object.entries(tools ?? {})) {
    if (seen.has(tool.id)) {
      throw invalidArgument(`tools.${name}`, 'repeats an id');
    }
    seen.add(tool.id);
    ordered.push(tool);
    refs.push({
      key: tool.id,
      implementationVersion: tool.version,
      config: null,
      approval: null,
    });
  }
  return { refs, ordered };
}

/** The config path for a document path. The document renames four groups. */
function configPath(path: readonly PropertyKey[]): string {
  const [head, second, third] = path;
  const text = path.map(String);
  if (head === 'model') {
    return second === 'reasoningEffort' ? second : 'model';
  }
  if (head === 'fallbacks' && typeof second === 'number') {
    const field = third === 'reasoningEffort' ? third : 'model';
    return `fallbacks.${String(second)}.${field}`;
  }
  if (head === 'memory' && second === 'workingMemoryScope') {
    return 'memory.workingMemory.scope';
  }
  if (head === 'memory' && second === 'messageHistory') {
    return 'memory.lastMessages';
  }
  return text.join('.');
}

export class Agent {
  readonly id: string;
  readonly name: string;

  constructor(config: AgentConfig) {
    if (typeof config.id !== 'string' || config.id === '') {
      throw invalidArgument('id', 'required');
    }
    if (
      !WorkingMemoryScope.safeParse(config.memory.workingMemory.scope).success
    ) {
      throw invalidArgument('memory.workingMemory.scope', 'not supported');
    }
    const tools = listedTools(config.tools);
    const candidate = {
      name: config.name,
      ...(config.description === undefined
        ? {}
        : { description: config.description }),
      instructions: config.instructions,
      model: modelChoice('model', config),
      ...(config.fallbacks === undefined
        ? {}
        : {
            fallbacks: config.fallbacks.map((fallback, index) =>
              modelChoice(`fallbacks.${String(index)}.model`, fallback),
            ),
          }),
      tools: tools.refs,
      memory: {
        workingMemoryScope: config.memory.workingMemory.scope,
        messageHistory: { maxMessages: config.memory.lastMessages },
      },
      limits: { ...config.limits },
      workspace: null,
      skills: [],
      subagents: [],
    } satisfies AgentDocument;
    const parsed = AgentDocumentSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw invalidArgument(
        issue === undefined ? 'config' : configPath(issue.path),
        'invalid',
      );
    }
    this.id = config.id;
    this.name = config.name;
    built.set(this, { document: candidate, tools: tools.ordered });
  }

  /** Starts a turn on `options.memory.thread` and waits until it ends or pauses. */
  generate(input: string, options: GenerateOptions): Promise<GenerateResult> {
    const { runtime, ...call } = options;
    return runtime.generate({ ...call, agentKey: this.id, input });
  }

  approveToolCall(
    target: ToolCallTarget,
    options: DecisionOptions & { readonly runtime: RuntimeSession },
  ): Promise<GenerateResult> {
    const { runtime, ...rest } = options;
    return runtime.approveToolCall(target, rest);
  }

  declineToolCall(
    target: ToolCallTarget,
    options: DecisionOptions & { readonly runtime: RuntimeSession },
  ): Promise<GenerateResult> {
    const { runtime, ...rest } = options;
    return runtime.declineToolCall(target, rest);
  }
}

/** The P3.1 document the constructor built, and the tools in author order. */
export function toAgentDocument(agent: Agent): Built {
  const found = built.get(agent);
  if (found === undefined) throw invalidArgument('agent', 'not an Agent');
  return found;
}
