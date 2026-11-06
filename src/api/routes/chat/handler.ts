import { randomUUID } from 'node:crypto';
import { err, ErrorCode, ok } from '../../../index.ts';
import type { Result, z } from '../../../index.ts';
import type { OrgId } from '../../../db/index.ts';
import type { Caller } from '../../../identity/index.ts';
import {
  decide,
  editMessage as edit,
  listBlocked,
  markThreadDeleted,
  readConversation,
  renameThread,
  requestStop,
  retryMessage as retry,
  StartRefusal,
  startThread,
  startTurn,
  turnRequestContext,
  Verdict,
} from '../../../runtime/index.ts';
import type { BlockedAction } from '../../../runtime/index.ts';
import type { StartDeps, StopDeps } from '../../../runtime/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import { bind, emptyBody, emptyOk, orgScoped } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import { WireType } from '../../adapter/route-types.ts';
import { listReadable } from '../../conversation-access.ts';
import {
  approveBlockedAction,
  deleteConversation,
  denyBlockedAction,
  editMessage,
  getConversation,
  listBlockedActions,
  listConversations,
  renameConversation,
  PostMessageBody,
  type PostMessageReply,
  postMessage,
  retryMessage,
  startConversation,
  stopMessages,
} from './routes.ts';

/** PD4: `already_exists` reads by its message. Only `already_running` has a wire type of its own. */
function refused<T>(result: Result<T>): Result<T, ApiFailure> {
  if (
    !result.ok &&
    result.error.code === ErrorCode.already_exists &&
    result.error.message === StartRefusal.enum.already_running
  ) {
    return err({
      type: WireType.enum.already_running,
      message: result.error.message,
    });
  }
  return result;
}

function blockedOnWire(action: BlockedAction) {
  return {
    actionId: action.actionId,
    agentMessageId: action.agentMessageId,
    toolKey: action.toolKey,
    implementationVersion: action.implementationVersion,
    kind: action.kind,
    reason: action.reason,
    stake: action.stake,
    arguments: action.arguments,
    expiresAt: action.expiresAt.toISOString(),
  };
}

export function chat(deps: ApiDeps): BoundRoute[] {
  const { db, authz, runners, log, startConfig: config } = deps;
  const startDeps: StartDeps = { db, authz, runners, config, log };
  const stopDeps: StopDeps = { db, authz, runners };
  /** The one post path: the post route and start's `firstMessage` both call it (P13.5 D5). */
  const post = async (
    caller: Caller,
    org: OrgId,
    threadId: string,
    body: z.infer<typeof PostMessageBody>,
  ): Promise<Result<PostMessageReply, ApiFailure>> => {
    const requestContext = turnRequestContext(
      body.requestContext ?? {},
      caller.principal.id,
      org,
    );
    if (!requestContext.ok) return requestContext;
    const started = refused(
      await startTurn(startDeps, caller, org, {
        threadId,
        agentId: body.agentId,
        agentMessageId: body.agentMessageId,
        userMessage: { id: body.userMessageId, text: body.text },
        requestContext: requestContext.value,
        ...(body.modelSelection === undefined
          ? {}
          : { modelSelection: body.modelSelection }),
      }),
    );
    if (!started.ok) return started;
    const { value } = started;
    return value.kind === 'pending'
      ? ok({
          userMessageId: value.userMessageId,
          agentMessageId: null,
          pending: true as const,
        })
      : ok({
          userMessageId: body.userMessageId,
          agentMessageId: value.agentMessageId,
          pending: false as const,
        });
  };
  return [
    bind(
      listConversations,
      orgScoped((caller, org, { query }) =>
        listReadable(deps.authzAdmin, db, caller, org, {
          limit: query.limit,
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
      ),
    ),
    bind(
      startConversation,
      orgScoped(async (caller, org, { body }) => {
        const conversationId = randomUUID();
        const started = await startThread(
          db,
          caller,
          org,
          conversationId,
          body.title,
        );
        if (!started.ok) return started;
        // The thread row is committed before the register; a refusal leaves it as an orphan (D1 Cost).
        const registered = await deps.authzAdmin.registerConversation(
          caller,
          org,
          conversationId,
          body.spaceId,
        );
        if (!registered.ok) return registered;
        if (body.firstMessage === undefined) return ok({ conversationId });
        const message = await post(
          caller,
          org,
          conversationId,
          body.firstMessage,
        );
        return message.ok
          ? ok({ conversationId, message: message.value })
          : message;
      }),
    ),
    bind(
      getConversation,
      orgScoped((_caller, org, { params }) =>
        readConversation(db, org, params.conv),
      ),
    ),
    bind(
      renameConversation,
      orgScoped(async (_caller, org, { params, body }) =>
        emptyOk(await renameThread(db, org, params.conv, body.title)),
      ),
    ),
    bind(
      deleteConversation,
      orgScoped(async (_caller, org, { params }) =>
        emptyOk(await markThreadDeleted(db, org, params.conv)),
      ),
    ),
    bind(
      postMessage,
      orgScoped((caller, org, { params, body }) =>
        post(caller, org, params.conv, body),
      ),
    ),
    bind(
      stopMessages,
      orgScoped(async (caller, org, { body }) => {
        for (const messageId of body.messageIds) {
          const stopped = await requestStop(
            stopDeps,
            caller,
            org,
            messageId,
            body.kind,
          );
          if (!stopped.ok) return stopped;
        }
        return ok(emptyBody);
      }),
    ),
    bind(
      editMessage,
      orgScoped(async (caller, org, { params, body }) =>
        refused(
          await edit(startDeps, caller, org, params.conv, params.msg, {
            text: body.text,
          }),
        ),
      ),
    ),
    bind(
      retryMessage,
      orgScoped(async (caller, org, { params, body }) =>
        refused(
          await retry(startDeps, caller, org, params.conv, params.msg, {
            idempotencyKey: body.idempotencyKey,
            ...(body.agentId === undefined ? {} : { agentId: body.agentId }),
            ...(body.modelSelection === undefined
              ? {}
              : { modelSelection: body.modelSelection }),
          }),
        ),
      ),
    ),
    bind(
      listBlockedActions,
      orgScoped(async (caller, org, { params }) => {
        const listed = await listBlocked(
          { db, authz },
          caller,
          org,
          params.conv,
        );
        return listed.ok
          ? ok({ items: listed.value.map(blockedOnWire) })
          : listed;
      }),
    ),
    bind(
      approveBlockedAction,
      orgScoped(async (caller, org, { params, body }) =>
        emptyOk(
          await decide(startDeps, caller, org, params.action, {
            verdict: Verdict.approve,
            ...(body.remember === undefined ? {} : { remember: body.remember }),
          }),
        ),
      ),
    ),
    bind(
      denyBlockedAction,
      orgScoped(async (caller, org, { params }) =>
        emptyOk(
          await decide(startDeps, caller, org, params.action, {
            verdict: Verdict.deny,
          }),
        ),
      ),
    ),
  ];
}
