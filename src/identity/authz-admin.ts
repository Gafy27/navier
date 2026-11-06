import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import type { AuthzConfig } from './authz-config.ts';
import {
  authzCallLog,
  bearerHeader,
  chunked,
  failureCode,
  FailureOp,
  toDecision,
} from './authz.ts';
import type { Caller } from './caller.ts';
import { DenyReason } from './decision.ts';
import type { Decision } from './decision.ts';
import { AuthzObjectType, authzObject } from './scope-map.ts';
import { Authz as AuthzService } from './gen/cosmos/authz/v1/authz_pb.js';
import type { AuditEvent } from './gen/cosmos/authz/v1/authz_pb.js';

/** An authz-api object in wire form: `type` and the full id, such as `A~s1`. */
export interface ObjectRef {
  readonly type: string;
  readonly id: string;
}

export interface GrantEntry {
  readonly principal: string;
  readonly privilege: string;
}

/** One marking role write (wire `RoleEntry`). */
export interface RoleEntry {
  readonly principal: string;
  readonly role: string;
}

export interface ObjectGrantsInput {
  readonly object: ObjectRef;
  readonly writes?: readonly GrantEntry[];
  readonly deletes?: readonly GrantEntry[];
}

/** One audit row as authz-api returns it. `uint64` fields are decimal strings, `at` is ISO 8601. */
export interface AuditEventView {
  readonly id: string;
  readonly attemptId?: string | undefined;
  readonly action: string;
  readonly outcome: string;
  readonly actor?: string | undefined;
  readonly object: string;
  readonly relation?: string | undefined;
  readonly target?: string | undefined;
  readonly statusCode?: string | undefined;
  readonly traceId?: string | undefined;
  readonly at?: string | undefined;
}

/** The authz-api RPCs `Authz` does not wrap. Every call sends the caller's own token (PD1). */
export interface AuthzAdmin {
  /** One decision per item, in order. Chunked by `AUTHZ_CHECK_MAX_ITEMS` (C4). */
  readonly checkObjects: (
    caller: Caller,
    org: OrgId,
    items: readonly { readonly object: ObjectRef; readonly action: string }[],
  ) => Promise<Result<Decision[]>>;
  /** One `WriteGrants` carrying every object: all or none. */
  readonly writeGrants: (
    caller: Caller,
    org: OrgId,
    objects: readonly ObjectGrantsInput[],
  ) => Promise<Result<void>>;
  readonly listGrants: (
    caller: Caller,
    org: OrgId,
    object: ObjectRef,
    continuation?: string,
  ) => Promise<Result<{ grants: GrantEntry[]; continuation?: string }>>;
  readonly listGrantable: (
    caller: Caller,
    org: OrgId,
    type: string,
  ) => Promise<Result<{ privileges: string[] }>>;
  readonly createMarkingCategory: (
    caller: Caller,
    org: OrgId,
    id: string,
  ) => Promise<Result<void>>;
  readonly createMarking: (
    caller: Caller,
    org: OrgId,
    category: string,
    id: string,
  ) => Promise<Result<void>>;
  readonly writeMarkingRoles: (
    caller: Caller,
    org: OrgId,
    target: { readonly categoryId: string } | { readonly markingId: string },
    writes: readonly RoleEntry[],
    deletes: readonly RoleEntry[],
  ) => Promise<Result<void>>;
  readonly applyMarking: (
    caller: Caller,
    org: OrgId,
    object: ObjectRef,
    marking: string,
  ) => Promise<Result<void>>;
  readonly removeMarking: (
    caller: Caller,
    org: OrgId,
    object: ObjectRef,
    marking: string,
  ) => Promise<Result<void>>;
  /** `after` is a decimal `uint64`; `0` on the wire is absent here (C7). */
  readonly listAuditEvents: (
    caller: Caller,
    org: OrgId,
    query: { readonly object?: ObjectRef; readonly after?: string },
  ) => Promise<Result<{ events: AuditEventView[]; after?: string }>>;
  /** Makes the caller the owner of `conversation:<org>~<threadId>` in `space:<org>~<spaceId>` (P13.5 PD1). */
  readonly registerConversation: (
    caller: Caller,
    org: OrgId,
    threadId: string,
    spaceId: string,
  ) => Promise<Result<void>>;
}

/** authz-api's own message for a refused call. A transport failure gets a fixed one instead. */
function refusal(e: unknown, code: ErrorCode): string {
  return code === ErrorCode.unavailable
    ? 'authz-api unavailable'
    : ConnectError.from(e).rawMessage;
}

/** The reason a failed `Check` chunk denies its own items, as `checkMany` does. */
function chunkDenyReason(code: Code): DenyReason {
  switch (code) {
    case Code.NotFound:
      return DenyReason.not_visible;
    case Code.PermissionDenied:
      return DenyReason.no_grant;
    default:
      return DenyReason.unavailable;
  }
}

function auditView(event: AuditEvent): AuditEventView {
  return {
    id: String(event.id),
    attemptId:
      event.attemptId === undefined ? undefined : String(event.attemptId),
    action: event.action,
    outcome: event.outcome,
    actor: event.actor,
    object: event.object,
    relation: event.relation,
    target: event.target,
    statusCode: event.statusCode,
    traceId: event.traceId,
    at:
      event.at === undefined
        ? undefined
        : timestampDate(event.at).toISOString(),
  };
}

/** Builds the client. No network call happens here. */
export function createAuthzAdmin(
  config: AuthzConfig,
  logger: Logger,
): AuthzAdmin {
  const client = createClient(
    AuthzService,
    createGrpcTransport({
      baseUrl: config.AUTHZ_API_URL,
      defaultTimeoutMs: config.AUTHZ_TIMEOUT_MS,
    }),
  );
  const maxItems = config.AUTHZ_CHECK_MAX_ITEMS;

  const callLog = (
    method: string,
    org: OrgId,
    caller: Caller,
  ): ((outcome: string) => void) =>
    authzCallLog(logger, method, org, caller.principal.id);

  /** One RPC on the caller's token. A failure maps through the `write` table (C8). */
  async function call<T>(
    method: string,
    caller: Caller,
    org: OrgId,
    send: (options: { headers: Record<string, string> }) => Promise<T>,
  ): Promise<Result<T>> {
    const log = callLog(method, org, caller);
    try {
      const value = await send({ headers: bearerHeader(caller.credential) });
      log('ok');
      return ok(value);
    } catch (e) {
      const code = failureCode(e, true, FailureOp.enum.write);
      log(code);
      return err(appError(code, refusal(e, code)));
    }
  }

  const done = (r: Result<unknown>): Result<void> => (r.ok ? ok(undefined) : r);

  return {
    checkObjects: async (caller, org, items) => {
      const log = callLog('checkObjects', org, caller);
      const out: Decision[] = [];
      for (const chunk of chunked(items, maxItems)) {
        try {
          const res = await client.check(
            {
              items: chunk.map(({ object, action }) => ({
                object: { type: object.type, id: object.id },
                action,
              })),
            },
            { headers: bearerHeader(caller.credential) },
          );
          out.push(...chunk.map((_, i) => toDecision(res.decisions[i])));
        } catch (e) {
          const code = ConnectError.from(e).code;
          if (code === Code.Unauthenticated) {
            log(ErrorCode.unauthenticated);
            return err(
              appError(ErrorCode.unauthenticated, 'authentication failed'),
            );
          }
          if (code === Code.InvalidArgument) {
            log(ErrorCode.internal);
            return err(
              appError(ErrorCode.internal, 'authz-api refused the check batch'),
            );
          }
          const reason = chunkDenyReason(code);
          out.push(...chunk.map(() => ({ allow: false as const, reason })));
        }
      }
      log('ok');
      return ok(out);
    },
    writeGrants: async (caller, org, objects) =>
      done(
        await call('writeGrants', caller, org, (options) =>
          client.writeGrants(
            {
              objects: objects.map(({ object, writes, deletes }) => ({
                object: { type: object.type, id: object.id },
                writes: [...(writes ?? [])],
                deletes: [...(deletes ?? [])],
              })),
            },
            options,
          ),
        ),
      ),
    listGrants: async (caller, org, object, continuation) => {
      const res = await call('listGrants', caller, org, (options) =>
        client.listGrants(
          {
            object: { type: object.type, id: object.id },
            continuationToken: continuation ?? '',
          },
          options,
        ),
      );
      if (!res.ok) return res;
      const grants = res.value.grants.map(({ principal, privilege }) => ({
        principal,
        privilege,
      }));
      const next = res.value.nextContinuationToken;
      return ok(next === '' ? { grants } : { grants, continuation: next });
    },
    listGrantable: async (caller, org, type) => {
      const res = await call('listGrantable', caller, org, (options) =>
        client.listGrantable({ type }, options),
      );
      return res.ok ? ok({ privileges: [...res.value.privileges] }) : res;
    },
    createMarkingCategory: async (caller, org, id) =>
      done(
        await call('createMarkingCategory', caller, org, (options) =>
          client.createMarkingCategory(
            { categoryId: id, organizationId: org },
            options,
          ),
        ),
      ),
    createMarking: async (caller, org, category, id) =>
      done(
        await call('createMarking', caller, org, (options) =>
          client.createMarking(
            { markingId: id, categoryId: category },
            options,
          ),
        ),
      ),
    writeMarkingRoles: async (caller, org, target, writes, deletes) =>
      done(
        await call('writeMarkingRoles', caller, org, (options) =>
          client.writeMarkingRoles(
            {
              target:
                'categoryId' in target
                  ? { case: 'categoryId', value: target.categoryId }
                  : { case: 'markingId', value: target.markingId },
              writes: [...writes],
              deletes: [...deletes],
            },
            options,
          ),
        ),
      ),
    applyMarking: async (caller, org, object, marking) =>
      done(
        await call('applyMarking', caller, org, (options) =>
          client.applyMarking(
            {
              object: { type: object.type, id: object.id },
              markingId: marking,
            },
            options,
          ),
        ),
      ),
    removeMarking: async (caller, org, object, marking) =>
      done(
        await call('removeMarking', caller, org, (options) =>
          client.removeMarking(
            {
              object: { type: object.type, id: object.id },
              markingId: marking,
            },
            options,
          ),
        ),
      ),
    listAuditEvents: async (caller, org, query) => {
      const res = await call('listAuditEvents', caller, org, (options) =>
        client.listAuditEvents(
          {
            organizationId: org,
            object:
              query.object === undefined
                ? undefined
                : { type: query.object.type, id: query.object.id },
            after: query.after === undefined ? 0n : BigInt(query.after),
          },
          options,
        ),
      );
      if (!res.ok) return res;
      const events = res.value.events.map(auditView);
      const next = res.value.nextAfter;
      return ok(next === 0n ? { events } : { events, after: String(next) });
    },
    registerConversation: async (caller, org, threadId, spaceId) =>
      done(
        await call('registerConversation', caller, org, (options) =>
          client.registerConversation(
            {
              conversation: authzObject(
                org,
                AuthzObjectType.conversation,
                threadId,
              ),
              space: authzObject(org, AuthzObjectType.space, spaceId),
            },
            options,
          ),
        ),
      ),
  };
}
