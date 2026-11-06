import { appError, ErrorCode, z } from '../index.ts';
import type { Result } from '../index.ts';
import { deriveAgentId } from '../agents/index.ts';
import { enableTool, ServingStatus, servingStatus } from '../catalog/index.ts';
import {
  DenyReason,
  formatScope,
  getAgentPrincipal,
  listScopeRequests,
} from '../identity/index.ts';
import type { PrincipalId, Scope, ScopeRequest } from '../identity/index.ts';
import { setModelPolicy } from '../models/index.ts';
import type { ModelRef } from '../models/index.ts';
import { SdkError } from '../sdk/index.ts';
import { withSession } from './publish.ts';
import type { PublishOptions, Session } from './publish.ts';

/** The publish options, plus an optional override for the request-list page size. */
export type AdminOptions = PublishOptions & { readonly pageSize?: number };

export interface AgentRequest {
  readonly scope: string;
  readonly requestedBy: string;
  readonly granted: boolean;
}

function fail(code: ErrorCode, message: string): never {
  throw new SdkError(appError(code, message));
}

function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  return fail(result.error.code, result.error.message);
}

/** Whether `who` holds `scope` now. An unreachable authz-api is `unavailable`, never an answer. */
async function holds(
  session: Session,
  who: PrincipalId | Session['caller'],
  scope: string,
): Promise<boolean> {
  const decision = unwrap(await session.authz.check(session.org, who, scope));
  if (decision.allow) return true;
  if (decision.reason === DenyReason.unavailable) {
    fail(ErrorCode.unavailable, 'authz-api unavailable');
  }
  return false;
}

/** D1: appends `enabled: true` after the store checks `tool:enable:<key>` for the operator. */
export function setToolEnabled(
  pair: { readonly key: string; readonly version: number },
  options: PublishOptions,
): Promise<{
  key: string;
  version: number;
  enabled: true;
  serving: z.infer<typeof ServingStatus> | null;
}> {
  const { key, version } = pair;
  return withSession(options, async ({ db, authz, caller, org }) => {
    const done = await enableTool(authz, db, caller, org, key, version, true);
    if (!done.ok) {
      const { code, message } = done.error;
      return fail(
        code,
        code === ErrorCode.not_found
          ? `tool ${key}@${String(version)}: not found`
          : message,
      );
    }
    return {
      key,
      version,
      enabled: true as const,
      serving: await servingStatus(db, org, key, version),
    };
  });
}

/** D1: appends an enabled, not degraded policy after the store checks `model:admin`. */
export function setModelEnabled(
  ref: ModelRef,
  options: PublishOptions,
): Promise<{
  provider: string;
  model: string;
  enabled: true;
  degraded: false;
}> {
  return withSession(options, async ({ db, authz, caller, org }) => {
    const { provider, model } = ref;
    unwrap(
      await setModelPolicy(authz, db, caller, org, {
        provider,
        model,
        enabled: true,
        degraded: false,
      }),
    );
    return {
      provider,
      model,
      enabled: true as const,
      degraded: false as const,
    };
  });
}

interface Stored {
  readonly principal: PrincipalId;
  readonly requests: Pick<ScopeRequest, 'text' | 'scope' | 'requestedBy'>[];
}

/** The agent's principal and every request row, paged to the end. */
async function readRequests(
  session: Session,
  agent: string,
  pageSize: number,
): Promise<Stored> {
  const { db, org } = session;
  const found = await getAgentPrincipal(db, org, deriveAgentId(org, agent));
  if (!found.ok) {
    return found.error.code === ErrorCode.not_found
      ? fail(ErrorCode.invalid_argument, `agent ${agent}: not published`)
      : fail(found.error.code, found.error.message);
  }
  const requests: Stored['requests'] = [];
  let after: string | undefined;
  for (;;) {
    const page = unwrap(
      await listScopeRequests(db, org, found.value.id, pageSize, after),
    );
    const last = page.at(-1);
    if (last === undefined) break;
    for (const { text, scope, requestedBy } of page) {
      requests.push({ text, scope, requestedBy });
    }
    after = last.id;
  }
  return { principal: found.value.id, requests };
}

const pageSizeOf = (session: Session, options: AdminOptions): number =>
  options.pageSize ?? session.agents.REQUEST_PAGE_SIZE;

/** D2: each request, with whether the agent's own `check` allows it now. A retired request is never checked. */
export function listAgentRequests(
  agent: string,
  options: AdminOptions,
): Promise<{ agent: string; requests: AgentRequest[] }> {
  return withSession(options, async (session) => {
    const stored = await readRequests(
      session,
      agent,
      pageSizeOf(session, options),
    );
    const requests: AgentRequest[] = [];
    for (const row of stored.requests) {
      requests.push({
        scope: row.text,
        requestedBy: row.requestedBy,
        granted:
          row.scope !== null &&
          (await holds(session, stored.principal, row.text)),
      });
    }
    return { agent, requests };
  });
}

/**
 * D2: grants requested scopes the agent does not hold yet, all or none. The
 * operator must hold each one; the first they do not hold is named.
 */
export function grantAgentRequests(
  agent: string,
  scopes: readonly string[] | undefined,
  options: AdminOptions,
): Promise<{ agent: string; granted: string[] }> {
  return withSession(options, async (session) => {
    const stored = await readRequests(
      session,
      agent,
      pageSizeOf(session, options),
    );
    const requested = new Map(
      stored.requests.map((row) => [row.text, row.scope]),
    );
    const chosen =
      scopes ??
      stored.requests.filter((row) => row.scope !== null).map((r) => r.text);
    const picked: Scope[] = [];
    for (const text of new Set(chosen)) {
      const scope = requested.get(text);
      if (scope === undefined) {
        return fail(ErrorCode.invalid_argument, `scope ${text}: not requested`);
      }
      if (scope === null) {
        return fail(ErrorCode.invalid_argument, `scope ${text}: retired`);
      }
      if (!(await holds(session, stored.principal, text))) picked.push(scope);
    }
    for (const scope of picked) {
      const text = formatScope(scope);
      if (!(await holds(session, session.caller, text))) {
        return fail(ErrorCode.permission_denied, `missing ${text}`);
      }
    }
    if (picked.length > 0) {
      unwrap(
        await session.authz.grant(
          session.caller,
          session.org,
          stored.principal,
          picked,
        ),
      );
    }
    return { agent, granted: picked.map(formatScope) };
  });
}
