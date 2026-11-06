import type { ColumnType, Generated } from 'kysely';
import type { Db, OrgId } from '../db/index.ts';
import type { AgentDefinition } from '../agents/index.ts';
import type { ResolutionMethod } from '../models/index.ts';
import type { RequestContext } from './request-context.ts';
import type { BlockKind, RecoveryOutcome } from './status.ts';

/** This unit's tables. `withTables` adds them to a `Tx`; `runtimeView` to a `Db`. */
export type RuntimeTables = {
  thread: {
    org_id: OrgId;
    id: string;
    created_by: string;
    /** Null when the start named no title. Optional on insert. */
    title: ColumnType<string | null, string | null | undefined, string | null>;
    created_at: Generated<Date>;
  };
  /** D8: a rename or a soft delete of a thread. A `deleted` row hides the thread. */
  thread_state: {
    id: Generated<string>;
    org_id: OrgId;
    thread_id: string;
    kind: 'title' | 'deleted';
    /** Set on a `title` row only. */
    title: string | null;
    at: Generated<Date>;
  };
  message: {
    org_id: OrgId;
    id: string;
    thread_id: string;
    rank: number;
    role: 'user' | 'agent';
    text: string | null;
    user_message_id: string | null;
    agent_id: string | null;
    agent_version: number | null;
    trace_id: string | null;
    request_context: RequestContext | null;
    max_steps: number | null;
    /** The caller's key of a retry; null on every other row. */
    retry_key: string | null;
    created_by: string;
    created_at: Generated<Date>;
  };
  message_status: {
    org_id: OrgId;
    message_id: string;
    seq: number;
    status: string;
    reason: string | null;
    /** Non-null only on a `paused` row. Optional on insert. */
    expires_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
    /** The message-channel `seq`; set on a terminal row only (PD8, C2). */
    stream_seq: number | null;
    at: Generated<Date>;
  };
  model_resolution: {
    org_id: OrgId;
    message_id: string;
    seq: number;
    provider: string;
    model: string;
    reasoning_effort: string | null;
    method: ResolutionMethod;
    at: Generated<Date>;
  };
  stored_object: {
    org_id: OrgId;
    id: string;
    sha256: string;
    bytes: Buffer;
    size: number;
    content_type: string;
    created_at: Generated<Date>;
  };
  step: {
    org_id: OrgId;
    message_id: string;
    step_index: number;
    run_key: string;
    content: unknown;
    finish_reason: string;
    usage: unknown;
    trace_object_id: string;
    trace_truncated: boolean;
    /** The message-channel `seq` (PD8); null on rows written before 13_0005. */
    stream_seq: number | null;
    at: Generated<Date>;
  };
  action: {
    org_id: OrgId;
    id: string;
    message_id: string;
    step_index: number;
    call_index: number;
    tool_call_id: string;
    tool_key: string;
    implementation_version: number | null;
    arguments: unknown;
    config_snapshot: unknown;
    /** The message-channel `seq` (PD8); null on rows written before 13_0005. */
    stream_seq: number | null;
    at: Generated<Date>;
  };
  action_status: {
    org_id: OrgId;
    action_id: string;
    seq: number;
    status: string;
    reason: string | null;
    attempt: number | null;
    resume_pointer: unknown;
    /** Non-null only on a `blocked` row. */
    block_kind: BlockKind | null;
    /** A JSON value; non-null only on a `blocked` row. */
    block_pointer: unknown;
    at: Generated<Date>;
  };
  action_output: {
    org_id: OrgId;
    action_id: string;
    model_text: string;
    is_error: boolean;
    truncated: boolean;
    object_id: string | null;
    /** The message-channel `seq` (PD8); null on rows written before 13_0005. */
    stream_seq: number | null;
    at: Generated<Date>;
  };
  step_claim: {
    org_id: OrgId;
    message_id: string;
    step_index: number;
    attempt: number;
    at: Generated<Date>;
  };
  stop_requested: {
    org_id: OrgId;
    message_id: string;
    kind: 'cancel' | 'interrupt';
    by: string;
    at: Generated<Date>;
  };
  recovery: {
    org_id: OrgId;
    message_id: string;
    seq: number;
    outcome: RecoveryOutcome;
    at: Generated<Date>;
  };
  approval_memory: {
    org_id: OrgId;
    agent_id: string;
    tool_key: string;
    /** Empty string for a per-key row; `canonicalHash(args)` for a per-arguments row. */
    args_hash: string;
    action_id: string;
    decided_by: string;
    at: Generated<Date>;
  };
  action_decision: {
    org_id: OrgId;
    action_id: string;
    /** The `seq` of the `blocked` action_status row this decision answers. */
    blocked_seq: number;
    verdict: 'approve' | 'deny';
    remember: boolean;
    decided_by: string;
    at: Generated<Date>;
  };
  stream_delta: {
    org_id: OrgId;
    message_id: string;
    seq: number;
    kind: 'text' | 'reasoning';
    trace_id: string;
    text: string;
    expires_at: Date;
  };
  /** One pause snapshot on the message channel (PD14). */
  message_pause: {
    org_id: OrgId;
    message_id: string;
    stream_seq: number;
    blocked: unknown;
  };
  conversation_event: {
    org_id: OrgId;
    thread_id: string;
    seq: number;
    kind: 'message' | 'title' | 'promoted' | 'done';
    message_id: string | null;
    payload: unknown;
    at: Generated<Date>;
  };
  /** A user message posted while its agent ran, with the plan it will run under (P4.6 D1). */
  pending_message: {
    org_id: OrgId;
    user_message_id: string;
    thread_id: string;
    agent_id: string;
    agent_version: number;
    /** A JSON array: written as a string, read back parsed. */
    tools: ColumnType<AgentDefinition['tools'], string, string>;
    provider: string;
    model: string;
    reasoning_effort: string | null;
    method: ResolutionMethod;
    request_context: RequestContext;
    max_steps: number | null;
    at: Generated<Date>;
  };
  /** Closes a pending message: promoted to `agent_message_id`, or dropped with a reason. */
  pending_close: {
    org_id: OrgId;
    user_message_id: string;
    agent_message_id: string | null;
    dropped_reason: string | null;
    at: Generated<Date>;
  };
  /** One row per channel parent; its row lock orders the `seq` (C1). Not append-only. */
  stream_counter: {
    org_id: OrgId;
    channel: 'message' | 'conversation';
    parent_id: string;
    last_seq: number;
  };
};

/** Read side of `withTables`: the same `Db`, typed with this unit's tables. */
export function runtimeView(db: Db) {
  return db.$extendTables<RuntimeTables>();
}
