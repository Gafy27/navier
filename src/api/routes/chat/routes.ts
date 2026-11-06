import { JsonValueSchema, z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  WireType,
} from '../../adapter/route-types.ts';

/** The OpenAPI tag of the chat routes. */
const CHAT_TAG = 'chat';

/** A copy of the runtime's `StopRequestKind`, so this file stays pure. A mismatch fails the handler's typecheck. */
export const StopKindWire = z.enum({
  cancel: 'cancel',
  interrupt: 'interrupt',
  graceful: 'graceful',
});

/** The authz-api object type and action of a conversation route (P13.5 D1, PD1). */
export const CONVERSATION_OBJECT = 'conversation';
const POST_ACTION = 'can_post';
const READ_ACTION = 'can_read';
const ORG_PARAM = 'org';
const CONVERSATION_PARAM = 'conv';

const Id = z.string().min(1);
const Text = z.string().min(1);
const PageLimit = z.coerce.number().int();

const orgParams = z.strictObject({ org: Id });
const conversationParams = z.strictObject({ org: Id, conv: Id });
const messageParams = z.strictObject({ org: Id, conv: Id, msg: Id });
const actionParams = z.strictObject({ org: Id, conv: Id, action: Id });

/** A copy of the runtime's `BlockKind`, so this file stays pure. */
const BlockKindWire = z.enum({
  approval: 'approval',
  authentication: 'authentication',
  retry: 'retry',
});

/** A copy of the runtime's `Approval` stake labels. */
const StakeWire = z.enum({
  never_ask: 'never_ask',
  low: 'low',
  medium: 'medium',
  high: 'high',
});

/** One paused tool call a person may approve or deny (P5.3 `BlockedAction`). */
export const BlockedActionWire = z.strictObject({
  actionId: Id,
  agentMessageId: Id,
  toolKey: Id,
  implementationVersion: z.number().int(),
  kind: BlockKindWire,
  reason: z.string(),
  stake: StakeWire,
  arguments: JsonValueSchema,
  expiresAt: z.iso.datetime(),
});

/** A copy of the runtime's `ModelChoice`. The runtime parses it again before it is stored. */
const ModelSelectionWire = z.strictObject({
  provider: Id,
  model: Id,
  reasoningEffort: z.string().nullable(),
});

const ERRORS = [
  WireType.enum.unauthenticated,
  WireType.enum.forbidden,
  WireType.enum.not_found,
  WireType.enum.invalid_request,
  WireType.enum.conflict,
  WireType.enum.unavailable,
  WireType.enum.internal,
];
const base = { tag: CHAT_TAG, errors: ERRORS } as const;
const store = { kind: CheckKind.enum.store } as const;
/** The conversation check: the caller may post to `:conv`. */
const canPost = {
  kind: CheckKind.enum.object,
  type: CONVERSATION_OBJECT,
  idParams: [ORG_PARAM, CONVERSATION_PARAM],
  action: POST_ACTION,
} as const;
/** The conversation check for a read: the caller may read `:conv`. */
const canRead = {
  kind: CheckKind.enum.object,
  type: CONVERSATION_OBJECT,
  idParams: [ORG_PARAM, CONVERSATION_PARAM],
  action: READ_ACTION,
} as const;
const withRunning = [...ERRORS, WireType.enum.already_running];

/** The title bound on start (C1): 1 to 512 characters, `''` and 513 refused. */
const CONVERSATION_TITLE_MAX = 512;
const ConversationTitle = z.string().min(1).max(CONVERSATION_TITLE_MAX);

const Empty = z.strictObject({});

/** A copy of the runtime's `PendingState`, so this file stays pure. */
const PendingWire = z.union([
  z.strictObject({ kind: z.literal('open') }),
  z.strictObject({
    kind: z.literal('promoted'),
    agentMessageId: Id,
  }),
  z.strictObject({ kind: z.literal('dropped'), reason: z.string() }),
]);

/** A copy of the runtime's `ConversationView`, so this file stays pure. Status is the runtime's status text. */
const MessageWire = z.strictObject({
  id: Id,
  rank: z.number().int(),
  role: z.enum(['user', 'agent']),
  text: z.string().nullable(),
  agentId: z.string().nullable(),
  agentVersion: z.number().int().nullable(),
  status: z.string().nullable(),
  pending: PendingWire.nullable(),
  steps: z.array(JsonValueSchema).readonly(),
  actions: z.array(JsonValueSchema).readonly(),
});
const ConversationWire = z.strictObject({
  threadId: Id,
  messages: z.array(MessageWire).readonly(),
});

export const listConversations = defineRoute({
  ...base,
  operationId: 'listConversations',
  summary:
    'Lists the conversation ids the caller can read, filtered before the limit',
  method: Method.enum.GET,
  path: '/orgs/:org/conversations',
  check: store,
  params: orgParams,
  query: z.object({ limit: PageLimit, after: Id.optional() }),
  response: z.strictObject({
    items: z.array(z.string()),
    after: z.string().optional(),
  }),
});

export const getConversation = defineRoute({
  ...base,
  operationId: 'getConversation',
  summary:
    'Reads one conversation: its messages, steps, and actions, from rows only',
  method: Method.enum.GET,
  path: '/orgs/:org/conversations/:conv',
  check: canRead,
  params: conversationParams,
  response: ConversationWire,
});

export const renameConversation = defineRoute({
  ...base,
  operationId: 'renameConversation',
  summary: 'Renames a conversation (D8)',
  method: Method.enum.PATCH,
  path: '/orgs/:org/conversations/:conv',
  check: canPost,
  params: conversationParams,
  body: z.strictObject({ title: ConversationTitle }),
  response: Empty,
});

export const deleteConversation = defineRoute({
  ...base,
  operationId: 'deleteConversation',
  summary:
    'Soft-deletes a conversation; its rows stay, list and read answer not found (D8)',
  method: Method.enum.DELETE,
  path: '/orgs/:org/conversations/:conv',
  check: canPost,
  params: conversationParams,
  response: Empty,
});

/** The post body, shared by post and by start's `firstMessage` (D5). */
export const PostMessageBody = z.strictObject({
  userMessageId: Id,
  agentMessageId: Id,
  agentId: Id,
  text: Text,
  modelSelection: ModelSelectionWire.optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
});
/** L1 table: a started turn, or a pending post to the running agent (no agent message yet). */
const PostMessageResponse = z.union([
  z.strictObject({
    userMessageId: z.string(),
    agentMessageId: z.string(),
    pending: z.literal(false),
  }),
  z.strictObject({
    userMessageId: z.string(),
    agentMessageId: z.null(),
    pending: z.literal(true),
  }),
]);
export type PostMessageReply = z.infer<typeof PostMessageResponse>;

export const postMessage = defineRoute({
  ...base,
  errors: withRunning,
  operationId: 'postMessage',
  summary:
    'Posts a message to an explicit agent; both message ids are the caller’s',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations/:conv/messages',
  check: canPost,
  params: conversationParams,
  body: PostMessageBody,
  response: PostMessageResponse,
});

export const startConversation = defineRoute({
  ...base,
  errors: withRunning,
  operationId: 'startConversation',
  summary:
    'Starts a conversation in a space the caller is a member of, with an optional first message',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations',
  check: store,
  params: orgParams,
  body: z.strictObject({
    spaceId: Id,
    title: ConversationTitle.optional(),
    firstMessage: PostMessageBody.optional(),
  }),
  response: z.strictObject({
    conversationId: Id,
    message: PostMessageResponse.optional(),
  }),
});

export const stopMessages = defineRoute({
  ...base,
  operationId: 'stopMessages',
  summary:
    'Records a stop for each message id; the reaper writes the terminal status',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations/:conv/stop',
  check: canPost,
  params: conversationParams,
  body: z.strictObject({
    messageIds: z.array(Id).min(1),
    kind: StopKindWire,
  }),
  response: Empty,
});

export const editMessage = defineRoute({
  ...base,
  errors: withRunning,
  operationId: 'editMessage',
  summary: 'Edits the newest user message and starts a new agent message',
  method: Method.enum.PATCH,
  path: '/orgs/:org/conversations/:conv/messages/:msg',
  check: canPost,
  params: messageParams,
  body: z.strictObject({ text: Text }),
  response: z.strictObject({
    userMessageId: z.string(),
    agentMessageId: z.string(),
  }),
});

export const retryMessage = defineRoute({
  ...base,
  errors: withRunning,
  operationId: 'retryMessage',
  summary: 'Retries an agent message as a new agent message row',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations/:conv/messages/:msg/retry',
  check: canPost,
  params: messageParams,
  body: z.strictObject({
    idempotencyKey: Id,
    agentId: Id.optional(),
    modelSelection: ModelSelectionWire.optional(),
  }),
  response: z.strictObject({ agentMessageId: z.string() }),
});

export const listBlockedActions = defineRoute({
  ...base,
  operationId: 'listBlockedActions',
  summary:
    'Lists blocked tool calls on the newest agent message when it is paused',
  method: Method.enum.GET,
  path: '/orgs/:org/conversations/:conv/blocked-actions',
  check: canRead,
  params: conversationParams,
  response: z.strictObject({
    items: z.array(BlockedActionWire).readonly(),
  }),
});

export const approveBlockedAction = defineRoute({
  ...base,
  operationId: 'approveBlockedAction',
  summary: 'Approves one blocked tool call and resumes the agent message',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations/:conv/actions/:action/approve',
  check: canPost,
  params: actionParams,
  body: z.strictObject({ remember: z.boolean().optional() }),
  response: Empty,
});

export const denyBlockedAction = defineRoute({
  ...base,
  operationId: 'denyBlockedAction',
  summary: 'Denies one blocked tool call and records an error result',
  method: Method.enum.POST,
  path: '/orgs/:org/conversations/:conv/actions/:action/deny',
  check: canPost,
  params: actionParams,
  response: Empty,
});

export const chatRoutes = {
  listConversations,
  startConversation,
  getConversation,
  renameConversation,
  deleteConversation,
  postMessage,
  stopMessages,
  editMessage,
  retryMessage,
  listBlockedActions,
  approveBlockedAction,
  denyBlockedAction,
} as const;
