import type { MessageInitShape } from '@bufbuild/protobuf';
import { Code, ConnectError, createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { appError, err, ErrorCode, ok, z } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import type { OrgId } from '../db/index.ts';
import type { ReadinessProbe } from '../db/index.ts';
import type { AuthzConfig } from './authz-config.ts';
import type { Caller } from './caller.ts';
import { DenyReason } from './decision.ts';
import type { Decision } from './decision.ts';
import {
  Authz as AuthzService,
  Decision as Verdict,
} from './gen/cosmos/authz/v1/authz_pb.js';
import {
  Health,
  HealthCheckResponse_ServingStatus,
} from './gen/grpc/health/v1/health_pb.js';
import type { ObjectGrantsSchema } from './gen/cosmos/authz/v1/authz_pb.js';
import type { PrincipalId } from './principal.ts';
import { formatScope, parseScope } from './scope.ts';
import type { Scope } from './scope.ts';
import {
  agentVersionId,
  authzObject,
  parseAgentVersionId,
  toAuthzCheck,
} from './scope-map.ts';
import type { AuthzCheck } from './scope-map.ts';
import { createServiceToken } from './service-token.ts';

/** One generate or use question: the agent, and the version a turn pinned if any. */
export interface AgentUseQuery {
  readonly agentId: string;
  /** The message's pinned version. Omitted at generate and in a list. */
  readonly version?: number;
}

/** The answer to one `AgentUseQuery`. `not_visible` is the only negative answer (L4). */
export type AgentUse =
  | { readonly kind: 'open'; readonly version: number }
  | { readonly kind: 'direct' }
  | { readonly kind: 'not_visible' };

export interface Authz {
  /**
   * One scope for one principal in one org. The only `err` is `unauthenticated`,
   * when authz-api rejects a forwarded caller token. Every other failure is a deny reason.
   */
  readonly check: (
    org: OrgId,
    who: Caller | PrincipalId,
    scope: string,
  ) => Promise<Result<Decision>>;
  /**
   * Grants `scopes` to `to`, authorized by authz-api as `caller`. `unauthenticated`
   * when the caller token is rejected; `permission_denied` when the caller holds no such scope;
   * `not_found` when authz-api answers `NotFound` (an object the caller cannot see).
   */
  readonly grant: (
    caller: Caller,
    org: OrgId,
    to: PrincipalId,
    scopes: Scope[],
  ) => Promise<Result<void>>;
  /** Removes `scopes` from `to`. Same outcomes as `grant`. */
  readonly revoke: (
    caller: Caller,
    org: OrgId,
    to: PrincipalId,
    scopes: Scope[],
  ) => Promise<Result<void>>;
  /**
   * Grants `scopes` held by agent `parent` to agent `child`. `permission_denied`
   * names the first scope `parent` lacks; nothing is written then.
   */
  readonly delegate: (
    org: OrgId,
    parent: PrincipalId,
    child: PrincipalId,
    scopes: Scope[],
  ) => Promise<Result<void>>;
  /**
   * Registers agent `agentId` of `org` with `caller` as its only owner, on the
   * caller's own token. `permission_denied` when the caller may not create or
   * another person owns the agent.
   */
  readonly registerAgent: (
    caller: Caller,
    org: OrgId,
    agentId: string,
  ) => Promise<Result<void>>;
  /** One decision per scope, in order. Chunked by `AUTHZ_CHECK_MAX_ITEMS`. */
  readonly checkMany: (
    org: OrgId,
    caller: Caller,
    scopes: readonly Scope[],
  ) => Promise<Result<Decision[]>>;
  /** One answer per query, in order. Chunked by `AUTHZ_CHECK_MAX_ITEMS`. */
  readonly checkAgentUse: (
    caller: Caller,
    org: OrgId,
    queries: readonly AgentUseQuery[],
  ) => Promise<Result<AgentUse[]>>;
  readonly registerTool: (
    caller: Caller,
    org: OrgId,
    toolKey: string,
  ) => Promise<Result<void>>;
  readonly writeToolSpaces: (
    caller: Caller,
    org: OrgId,
    toolKey: string,
    change: {
      readonly add: readonly string[];
      readonly remove: readonly string[];
    },
  ) => Promise<Result<void>>;
  readonly publishAgentVersion: (
    caller: Caller,
    org: OrgId,
    agentId: string,
    version: number,
    pins: readonly { readonly toolKey: string; readonly space: string }[],
  ) => Promise<Result<void>>;
  readonly setAgentPublished: (
    caller: Caller,
    org: OrgId,
    agentId: string,
    published: boolean,
  ) => Promise<Result<void>>;
  readonly writeSpaceRoles: (
    caller: Caller,
    org: OrgId,
    space: string,
    writes: readonly {
      readonly principal: PrincipalId;
      readonly role: 'editor' | 'member';
    }[],
  ) => Promise<Result<void>>;
}

const healthKey = Symbol('authz health');

interface HealthHolder {
  readonly [healthKey]: (signal: AbortSignal) => Promise<boolean>;
}

export const bearerHeader = (token: {
  reveal: () => string;
}): Record<string, string> => ({
  authorization: `Bearer ${token.reveal()}`,
});

/** The one `authz call` line of a method: method, org, actor, outcome, ms. */
export function authzCallLog(
  logger: Logger,
  method: string,
  org: OrgId,
  actor: string,
): (outcome: string) => void {
  const started = Date.now();
  return (outcome) => {
    logger.info(
      { method, org, actor, outcome, ms: Date.now() - started },
      'authz call',
    );
  };
}

const deny = (reason: DenyReason): Result<Decision> =>
  ok({ allow: false, reason });

/** Which `failureCode` table applies. `write` is `grant`, `revoke`, and every `AuthzAdmin` call but `checkObjects` (P13.1 L3, P13.3 C8). */
export const FailureOp = z.enum({ check: 'check', write: 'write' });
export type FailureOp = z.infer<typeof FailureOp>;

/**
 * Maps a failed call to the code this service reports. `forwarded` is true when the caller's own token was sent.
 * On `'write'`, `NotFound`, `AlreadyExists`, and `Aborted` keep their own codes (P13.1 L3, P13.3 C8).
 */
export function failureCode(
  e: unknown,
  forwarded: boolean,
  op: FailureOp,
): ErrorCode {
  switch (ConnectError.from(e).code) {
    case Code.Unauthenticated:
      return forwarded ? ErrorCode.unauthenticated : ErrorCode.unavailable;
    case Code.NotFound:
      return op === FailureOp.enum.write
        ? ErrorCode.not_found
        : ErrorCode.permission_denied;
    case Code.PermissionDenied:
      return ErrorCode.permission_denied;
    case Code.InvalidArgument:
      return ErrorCode.invalid_argument;
    case Code.AlreadyExists:
      return op === FailureOp.enum.write
        ? ErrorCode.already_exists
        : ErrorCode.unavailable;
    case Code.Aborted:
      return op === FailureOp.enum.write
        ? ErrorCode.aborted
        : ErrorCode.unavailable;
    default:
      return ErrorCode.unavailable;
  }
}

type ObjectGrantsInit = MessageInitShape<typeof ObjectGrantsSchema>;

/**
 * Groups scopes by authz-api object, in first-seen order, one entry per privilege.
 * `field` says whether each entry is written or deleted.
 */
function toObjects(
  org: OrgId,
  to: PrincipalId,
  scopes: readonly Scope[],
  field: 'writes' | 'deletes',
): ObjectGrantsInit[] {
  const groups: { object: AuthzCheck['object']; privileges: string[] }[] = [];
  for (const scope of scopes) {
    const { object } = toAuthzCheck(org, scope);
    const privilege = scope.action;
    let group = groups.find(
      (g) => g.object.type === object.type && g.object.id === object.id,
    );
    if (group === undefined) {
      group = { object, privileges: [] };
      groups.push(group);
    }
    if (!group.privileges.includes(privilege)) group.privileges.push(privilege);
  }
  return groups.map(({ object, privileges }) => ({
    object,
    [field]: privileges.map((privilege) => ({ principal: to, privilege })),
  }));
}

/** A missing verdict is not an answer: it is `unavailable`. */
export function toDecision(verdict: Verdict | undefined): Decision {
  switch (verdict) {
    case Verdict.ALLOW:
      return { allow: true };
    case Verdict.DENY:
      return { allow: false, reason: DenyReason.no_grant };
    case Verdict.NOT_VISIBLE:
      return { allow: false, reason: DenyReason.not_visible };
    default:
      return { allow: false, reason: DenyReason.unavailable };
  }
}

export function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** The authz-api object string of an agent, the form `registerAgent` sends. */
function agentRef(org: OrgId, agentId: string): string {
  const object = authzObject(org, 'agent', agentId);
  return `${object.type}:${object.id}`;
}

/** Maps one `AgentUseQuery` answer. Any id that is not this agent's version is `internal` (D4). */
function useOf(
  org: OrgId,
  query: AgentUseQuery,
  answer:
    | { readonly decision: Verdict; readonly version?: string | undefined }
    | undefined,
): Result<AgentUse> {
  switch (answer?.decision) {
    case Verdict.ALLOW: {
      if (answer.version === undefined) return ok({ kind: 'direct' });
      const named = parseAgentVersionId(org, answer.version);
      if (
        named === undefined ||
        named.agentId !== query.agentId ||
        (query.version !== undefined && named.version !== query.version)
      ) {
        return err(
          appError(
            ErrorCode.internal,
            'authz-api returned a version of another agent',
          ),
        );
      }
      return ok({ kind: 'open', version: named.version });
    }
    case Verdict.NOT_VISIBLE:
      return ok({ kind: 'not_visible' });
    default:
      return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
  }
}

/** Builds the client. No network call happens here; the secret file is read once. */
export function createAuthz(config: AuthzConfig, logger: Logger): Authz {
  const transport = createGrpcTransport({
    baseUrl: config.AUTHZ_API_URL,
    defaultTimeoutMs: config.AUTHZ_TIMEOUT_MS,
  });
  const client = createClient(AuthzService, transport);
  const health = createClient(Health, transport);
  const serviceToken = createServiceToken(config, logger);
  const maxItems = config.AUTHZ_CHECK_MAX_ITEMS;

  const callLog = (
    method: string,
    org: OrgId,
    actor: string,
  ): ((outcome: string) => void) => authzCallLog(logger, method, org, actor);

  /** Sends one write and maps its failure. `forwarded` is true when `send` carries the caller's own token. */
  async function writeCall(
    method: string,
    org: OrgId,
    actor: string,
    forwarded: boolean,
    op: FailureOp,
    send: () => Promise<unknown>,
  ): Promise<Result<void>> {
    const log = callLog(method, org, actor);
    try {
      await send();
    } catch (e) {
      const code = failureCode(e, forwarded, op);
      if (!forwarded && ConnectError.from(e).code === Code.Unauthenticated) {
        logger.error({ org }, 'authz-api rejected the service credential');
      }
      log(code);
      return err(appError(code, `authz-api refused ${method}`));
    }
    log('ok');
    return ok(undefined);
  }

  /** A write on the caller's own token. */
  function forwardWrite(
    method: string,
    org: OrgId,
    caller: Caller,
    send: () => Promise<unknown>,
  ): Promise<Result<void>> {
    return writeCall(
      method,
      org,
      caller.principal.id,
      true,
      FailureOp.enum.check,
      send,
    );
  }

  /**
   * Sends one write request carrying every object. An empty list sends nothing.
   * `forwarded` is true when `send` carries the caller's own token.
   */
  async function writeObjects(
    method: string,
    org: OrgId,
    actor: string,
    objects: ObjectGrantsInit[],
    forwarded: boolean,
    op: FailureOp,
    send: (objects: ObjectGrantsInit[]) => Promise<unknown>,
  ): Promise<Result<void>> {
    if (objects.length === 0) return ok(undefined);
    return writeCall(method, org, actor, forwarded, op, () => send(objects));
  }

  /** The D2 table for a failed check. `undefined` means the forwarded caller token was rejected. */
  function checkOutcome(
    e: unknown,
    org: OrgId,
    actor: string,
    forwarded: boolean,
  ): DenyReason | undefined {
    const code = ConnectError.from(e).code;
    switch (code) {
      case Code.Unauthenticated:
        if (forwarded) return undefined;
        logger.error({ org }, 'authz-api rejected the service credential');
        return DenyReason.unavailable;
      case Code.PermissionDenied:
      case Code.NotFound:
        if (forwarded) {
          return code === Code.NotFound
            ? DenyReason.not_visible
            : DenyReason.no_grant;
        }
        logger.error(
          { org, agent: actor },
          'authz-api refused the agent assertion',
        );
        return DenyReason.unavailable;
      case Code.InvalidArgument:
        logger.error(
          { org, actor, code: 'invalid_argument' },
          'authz-api rejected the check object',
        );
        return DenyReason.invalid_scope;
      default:
        return DenyReason.unavailable;
    }
  }

  const authz: Authz & HealthHolder = {
    check: async (org, who, rawScope) => {
      const started = Date.now();
      const actor = typeof who === 'string' ? who : who.principal.id;
      const parsed = parseScope(rawScope);
      const log = (outcome: string): void => {
        logger.info(
          {
            method: 'check',
            org,
            actor,
            scope: rawScope,
            outcome,
            ms: Date.now() - started,
          },
          'authz call',
        );
      };
      if (!parsed.ok) {
        log(DenyReason.invalid_scope);
        return deny(DenyReason.invalid_scope);
      }
      const { object, action } = toAuthzCheck(org, parsed.value);
      const items = [{ object, action }];
      try {
        let decisions: readonly Verdict[];
        if (typeof who === 'string') {
          const token = await serviceToken();
          if (token === undefined) {
            log(DenyReason.unavailable);
            return deny(DenyReason.unavailable);
          }
          const headers = { headers: bearerHeader(token) };
          // A stored person (a publisher) is `user:…`; authz-api refuses it on CheckAsAgent.
          decisions = (
            who.startsWith('user:')
              ? await client.checkAsPrincipal(
                  { org, principal: who, items },
                  headers,
                )
              : await client.checkAsAgent({ agent: who, items }, headers)
          ).decisions;
        } else {
          decisions = (
            await client.check(
              { items },
              { headers: bearerHeader(who.credential) },
            )
          ).decisions;
        }
        const decision = toDecision(
          decisions.length === 1 ? decisions[0] : undefined,
        );
        log(decision.allow ? 'allow' : decision.reason);
        return ok(decision);
      } catch (e) {
        const mapped = checkOutcome(e, org, actor, typeof who !== 'string');
        if (mapped === undefined) {
          log(ErrorCode.unauthenticated);
          return err(
            appError(ErrorCode.unauthenticated, 'authentication failed'),
          );
        }
        log(mapped);
        return deny(mapped);
      }
    },
    grant: (caller, org, to, scopes) =>
      writeObjects(
        'grant',
        org,
        caller.principal.id,
        toObjects(org, to, scopes, 'writes'),
        true,
        FailureOp.enum.write,
        (objects) =>
          client.writeGrants(
            { objects },
            { headers: bearerHeader(caller.credential) },
          ),
      ),
    revoke: (caller, org, to, scopes) =>
      writeObjects(
        'revoke',
        org,
        caller.principal.id,
        toObjects(org, to, scopes, 'deletes'),
        true,
        FailureOp.enum.write,
        (objects) =>
          client.writeGrants(
            { objects },
            { headers: bearerHeader(caller.credential) },
          ),
      ),
    registerAgent: async (caller, org, agentId) => {
      try {
        const object = authzObject(org, 'agent', agentId);
        await client.registerAgent(
          { agent: `${object.type}:${object.id}` },
          { headers: bearerHeader(caller.credential) },
        );
      } catch (e) {
        const code = failureCode(e, true, FailureOp.enum.check);
        logger.info(
          {
            method: 'registerAgent',
            org,
            actor: caller.principal.id,
            outcome: code,
          },
          'authz call',
        );
        return err(appError(code, 'authz-api refused the registration'));
      }
      return ok(undefined);
    },
    delegate: async (org, parent, child, scopes) => {
      for (const scope of scopes) {
        const held = await authz.check(org, parent, formatScope(scope));
        if (!held.ok) return held;
        if (held.value.allow) continue;
        if (held.value.reason === DenyReason.unavailable) {
          return err(appError(ErrorCode.unavailable, 'authz-api unavailable'));
        }
        return err(
          appError(
            ErrorCode.permission_denied,
            `parent lacks ${formatScope(scope)}`,
          ),
        );
      }
      const token = await serviceToken();
      if (token === undefined) {
        return err(appError(ErrorCode.unavailable, 'no service token'));
      }
      return writeObjects(
        'delegate',
        org,
        parent,
        toObjects(org, child, scopes, 'writes'),
        false,
        FailureOp.enum.check,
        (objects) =>
          client.writeGrantsAsAgent(
            { agent: parent, objects },
            { headers: bearerHeader(token) },
          ),
      );
    },
    checkMany: async (org, caller, scopes) => {
      const actor = caller.principal.id;
      const log = callLog('checkMany', org, actor);
      const out: Decision[] = [];
      for (const chunk of chunked(scopes, maxItems)) {
        const items = chunk.map((scope) => toAuthzCheck(org, scope));
        try {
          const res = await client.check(
            { items },
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
          // A failed chunk denies its own scopes only, with the reason `check` gives.
          const reason =
            checkOutcome(e, org, actor, true) ?? DenyReason.unavailable;
          out.push(...chunk.map(() => ({ allow: false as const, reason })));
        }
      }
      log('ok');
      return ok(out);
    },
    checkAgentUse: async (caller, org, queries) => {
      const log = callLog('checkAgentUse', org, caller.principal.id);
      const out: AgentUse[] = [];
      for (const chunk of chunked(queries, maxItems)) {
        let answers: readonly {
          decision: Verdict;
          version?: string | undefined;
        }[];
        try {
          answers = (
            await client.checkAgentUse(
              {
                items: chunk.map((q) => ({
                  agent: agentRef(org, q.agentId),
                  version:
                    q.version === undefined
                      ? undefined
                      : agentVersionId(org, q.agentId, q.version),
                })),
              },
              { headers: bearerHeader(caller.credential) },
            )
          ).results;
        } catch (e) {
          const code = ConnectError.from(e).code;
          const failure =
            code === Code.Unauthenticated
              ? appError(ErrorCode.unauthenticated, 'authentication failed')
              : code === Code.InvalidArgument
                ? appError(
                    ErrorCode.invalid_argument,
                    'authz-api refused the use check',
                  )
                : appError(ErrorCode.unavailable, 'authz-api unavailable');
          log(failure.code);
          return err(failure);
        }
        for (const [i, query] of chunk.entries()) {
          const use = useOf(org, query, answers[i]);
          if (!use.ok) {
            log(use.error.code);
            return use;
          }
          out.push(use.value);
        }
      }
      log('ok');
      return ok(out);
    },
    registerTool: (caller, org, toolKey) =>
      forwardWrite('registerTool', org, caller, () =>
        client.registerTool(
          { tool: authzObject(org, 'tool', toolKey) },
          { headers: bearerHeader(caller.credential) },
        ),
      ),
    writeToolSpaces: (caller, org, toolKey, change) =>
      forwardWrite('writeToolSpaces', org, caller, () =>
        client.writeToolSpaces(
          {
            tool: authzObject(org, 'tool', toolKey),
            add: change.add.map((p) => authzObject(org, 'space', p)),
            remove: change.remove.map((p) => authzObject(org, 'space', p)),
          },
          { headers: bearerHeader(caller.credential) },
        ),
      ),
    publishAgentVersion: (caller, org, agentId, version, pins) =>
      forwardWrite('publishAgentVersion', org, caller, () =>
        client.publishAgentVersion(
          {
            agent: agentRef(org, agentId),
            version: agentVersionId(org, agentId, version),
            pins: pins.map((pin) => ({
              tool: authzObject(org, 'tool', pin.toolKey),
              space: authzObject(org, 'space', pin.space),
            })),
          },
          { headers: bearerHeader(caller.credential) },
        ),
      ),
    setAgentPublished: (caller, org, agentId, published) =>
      forwardWrite('setAgentPublished', org, caller, () =>
        client.setAgentPublished(
          { agent: agentRef(org, agentId), published },
          { headers: bearerHeader(caller.credential) },
        ),
      ),
    writeSpaceRoles: (caller, org, space, writes) =>
      forwardWrite('writeSpaceRoles', org, caller, () =>
        client.writeGrants(
          {
            objects: [
              {
                object: authzObject(org, 'space', space),
                writes: writes.map((w) => ({
                  principal: w.principal,
                  privilege: w.role,
                })),
                deletes: [],
              },
            ],
          },
          { headers: bearerHeader(caller.credential) },
        ),
      ),
    [healthKey]: async (signal) => {
      const res = await health.check({ service: '' }, { signal });
      return res.status === HealthCheckResponse_ServingStatus.SERVING;
    },
  };
  return authz;
}

/** Answers yes when authz-api reports serving within `AUTHZ_TIMEOUT_MS`. Any failure answers no. */
export function authzProbe(authz: Authz): ReadinessProbe {
  return {
    name: 'authz',
    check: async (signal) => {
      const reach = (authz as Partial<HealthHolder>)[healthKey];
      if (reach === undefined || signal.aborted) return false;
      try {
        return await reach(signal);
      } catch {
        return false;
      }
    },
  };
}
