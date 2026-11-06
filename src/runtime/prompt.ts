import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { loadVersion } from '../agents/index.ts';
import type { AgentDefinition } from '../agents/index.ts';
import { getTool } from '../catalog/index.ts';
import type { ToolEntry } from '../catalog/index.ts';
import { ProviderDataSchema } from '../llm/index.ts';
import type {
  ModelMessage,
  ModelRequest,
  ModelToolSpec,
} from '../llm/index.ts';
import { loadAgentMessage, newestResolution } from './messages.ts';
import type { AgentMessagePin } from './messages.ts';
import { runtimeView } from './tables.ts';

/** What a step row stores in `content`. */
export const StepContentSchema = z.object({
  text: z.string(),
  reasoning: z.array(
    z.object({ text: z.string(), providerData: ProviderDataSchema }),
  ),
  toolCalls: z.array(
    z.object({ id: z.string(), name: z.string(), input: z.unknown() }),
  ),
});

export interface Prompt {
  readonly request: ModelRequest;
  readonly pin: AgentMessagePin;
  readonly definition: AgentDefinition;
  /** The catalog entry each tool ref pins, by key. */
  readonly entries: ReadonlyMap<string, ToolEntry>;
}

const internal = (message: string) =>
  err(appError(ErrorCode.internal, message));

/** Skips the query: Postgres rejects `in ()`. */
async function queryForIds<Row>(
  ids: readonly string[],
  query: () => Promise<Row[]>,
): Promise<Row[]> {
  return ids.length === 0 ? [] : query();
}

/** Actions of one step, keyed by message id then step index. */
function actionsByStep<A extends { message_id: string; step_index: number }>(
  actions: readonly A[],
): Map<string, Map<number, A[]>> {
  const byMessage = new Map<string, Map<number, A[]>>();
  for (const action of actions) {
    let byIndex = byMessage.get(action.message_id);
    if (byIndex === undefined) {
      byIndex = new Map();
      byMessage.set(action.message_id, byIndex);
    }
    const group = byIndex.get(action.step_index);
    if (group === undefined) byIndex.set(action.step_index, [action]);
    else group.push(action);
  }
  return byMessage;
}

/** Tools offered, in author order, from the entries the refs pin. Disabled entries stay. */
async function loadTools(
  db: Db,
  org: OrgId,
  definition: AgentDefinition,
): Promise<
  Result<{ specs: ModelToolSpec[]; entries: Map<string, ToolEntry> }>
> {
  const specs: ModelToolSpec[] = [];
  const entries = new Map<string, ToolEntry>();
  for (const ref of definition.tools) {
    const entry = await getTool(db, org, ref.key, ref.implementationVersion);
    if (!entry.ok) return entry;
    entries.set(ref.key, entry.value);
    specs.push({
      name: ref.key,
      description: entry.value.description,
      inputSchema: entry.value.inputSchema,
    });
  }
  return ok({ specs, entries });
}

/**
 * The model messages of the thread window and of this message's earlier steps.
 * Past agent messages render without reasoning blocks (D6).
 */
async function loadMessages(
  db: Db,
  org: OrgId,
  pin: AgentMessagePin,
  messageId: string,
  maxMessages: number,
  stepIndex: number,
): Promise<Result<ModelMessage[]>> {
  const q = runtimeView(db);
  const window = (
    await q
      .selectFrom('message')
      .select(['id', 'role', 'text'])
      .where('org_id', '=', org)
      .where('thread_id', '=', pin.threadId)
      .where('rank', '<', pin.rank)
      .orderBy('rank', 'desc')
      .limit(maxMessages)
      .execute()
  ).reverse();
  const agentIds = [
    ...window.filter((m) => m.role === 'agent').map((m) => m.id),
    messageId,
  ];

  const steps = await q
    .selectFrom('step')
    .select(['message_id', 'step_index', 'content'])
    .where('org_id', '=', org)
    .where('message_id', 'in', agentIds)
    .orderBy('step_index', 'asc')
    .execute();
  const actions = await q
    .selectFrom('action')
    .select(['id', 'message_id', 'step_index', 'tool_call_id', 'tool_key'])
    .where('org_id', '=', org)
    .where('message_id', 'in', agentIds)
    .orderBy('call_index', 'asc')
    .execute();
  const actionIds = actions.map((a) => a.id);
  const outputs = await queryForIds(actionIds, () =>
    q
      .selectFrom('action_output')
      .select(['action_id', 'model_text', 'is_error'])
      .where('org_id', '=', org)
      .where('action_id', 'in', actionIds)
      .execute(),
  );
  const statuses = await queryForIds(actionIds, () =>
    q
      .selectFrom('action_status')
      .select(['action_id', 'status'])
      .where('org_id', '=', org)
      .where('action_id', 'in', actionIds)
      .orderBy('seq', 'desc')
      .execute(),
  );
  const outputOf = new Map(outputs.map((o) => [o.action_id, o]));
  const newestStatus = new Map<string, string>();
  for (const s of statuses) {
    if (!newestStatus.has(s.action_id)) newestStatus.set(s.action_id, s.status);
  }

  const stepActions = actionsByStep(actions);
  const rendered = new Map<string, ModelMessage[]>();
  for (const step of steps) {
    if (step.message_id === messageId && step.step_index >= stepIndex) continue;
    const content = StepContentSchema.safeParse(step.content);
    if (!content.success) return internal('stored step is invalid');
    const current = step.message_id === messageId;
    const out = rendered.get(step.message_id) ?? [];
    out.push({
      role: 'assistant',
      text: content.data.text,
      reasoning: current ? content.data.reasoning : [],
      toolCalls: content.data.toolCalls,
    });
    for (const action of stepActions
      .get(step.message_id)
      ?.get(step.step_index) ?? []) {
      const output = outputOf.get(action.id);
      out.push({
        role: 'tool',
        toolCallId: action.tool_call_id,
        name: action.tool_key,
        output: output?.model_text ?? newestStatus.get(action.id) ?? 'unknown',
        isError: output?.is_error ?? true,
      });
    }
    rendered.set(step.message_id, out);
  }

  const messages: ModelMessage[] = [];
  for (const m of window) {
    if (m.role === 'user') {
      messages.push({ role: 'user', text: m.text ?? '' });
    } else {
      messages.push(...(rendered.get(m.id) ?? []));
    }
  }
  messages.push(...(rendered.get(messageId) ?? []));
  return ok(messages);
}

/**
 * The only place a prompt is built (D6). Order: system, thread history, this
 * message's earlier steps. Phases 10 and 11 add sections here.
 */
export async function buildPrompt(
  db: Db,
  org: OrgId,
  messageId: string,
  stepIndex: number,
): Promise<Result<Prompt>> {
  const pin = await loadAgentMessage(db, org, messageId);
  if (!pin.ok) return pin;
  const version = await loadVersion(
    db,
    org,
    pin.value.agentId,
    pin.value.agentVersion,
  );
  if (!version.ok) return version;
  const { definition } = version.value;
  const resolution = await newestResolution(db, org, messageId);
  if (!resolution.ok) return resolution;
  const tools = await loadTools(db, org, definition);
  if (!tools.ok) return tools;
  const messages = await loadMessages(
    db,
    org,
    pin.value,
    messageId,
    definition.memory.messageHistory.maxMessages,
    stepIndex,
  );
  if (!messages.ok) return messages;
  return ok({
    request: {
      provider: resolution.value.provider,
      model: resolution.value.model,
      reasoningEffort: resolution.value.reasoningEffort,
      system: definition.instructions,
      messages: messages.value,
      tools: tools.value.specs,
    },
    pin: pin.value,
    definition,
    entries: tools.value.entries,
  });
}
