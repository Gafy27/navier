import { Hono } from 'hono';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { streamSSE } from 'hono/streaming';
import { appError, ErrorCode } from '../../index.ts';
import type { Logger } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import type { Db, OrgId } from '../../db/index.ts';
import type { Runners } from '../../runner/index.ts';
import type { AgentsConfig } from '../../agents/index.ts';
import type { StartConfig } from '../../runtime/index.ts';
import type {
  Authz,
  AuthzAdmin,
  Caller,
  CallerVerifier,
  PrincipalKind,
} from '../../identity/index.ts';
import { runCheck } from './check.ts';
import type { ApiConfig } from './config.ts';
import { apiInternal, apiNotFound, errorResponse } from './errors.ts';
import type { ApiFailure } from './errors.ts';
import type { IdpDirectory } from './idp-directory.ts';
import type { LoginConfig } from './login-config.ts';
import type { OidcClient } from './oidc.ts';
import { resolveCaller } from './session.ts';
import type { SessionDeps } from './session.ts';
import type { BoundRoute, HandlerContext } from './route.ts';
import { WireType } from './route-types.ts';
import type { StreamHub } from '../stream-hub.ts';

export interface ApiDeps {
  readonly db: Db;
  readonly runners: Runners;
  readonly authz: Authz;
  readonly authzAdmin: AuthzAdmin;
  readonly verifier: CallerVerifier;
  readonly config: ApiConfig;
  readonly log: Logger;
  readonly oidc: OidcClient;
  readonly login: LoginConfig;
  readonly agentsConfig: AgentsConfig;
  /** What `startTurn` needs to start a workflow (P13.5 C10). */
  readonly startConfig: StartConfig;
  /** The adapter names `setProvider` accepts (PD5). */
  readonly adapterNames: readonly string[];
  /** One LISTEN per process (P13.6 PD5). */
  readonly streamHub: StreamHub;
  /** Directory lookup for a grant write (D7). */
  readonly idpDirectory?: IdpDirectory;
  /** `PRINCIPAL_NAMESPACE` from caller config (D7). */
  readonly principalNamespace?: string;
  /** `SERVICE_SUBJECT_SUFFIX` from caller config (D7). */
  readonly serviceSubjectSuffix?: string;
}

/** What `resolveCaller` and the login functions need from the API deps (B1). */
export const sessionDepsOf = (deps: ApiDeps): SessionDeps => ({
  db: deps.db,
  verifier: deps.verifier,
  oidc: deps.oidc,
  config: deps.login,
  log: deps.log,
});

/** Every path on the list sits under this prefix (D3). */
const PREFIX = '/api/v1';
/** The `route` log id when no entry matched. */
const UNMATCHED = 'unmatched';
const ORG_PARAM = 'org';
const PARAM_MARK = ':';

const INVALID = appError(ErrorCode.invalid_argument, 'invalid request');
const TOO_LARGE: ApiFailure = {
  type: WireType.enum.payload_too_large,
  message: 'payload too large',
};

/** Literal segments sort before `:param` segments, so `/x/latest` is tried before `/x/:id`. */
function literalFirst(a: BoundRoute, b: BoundRoute): number {
  const left = a.contract.path.split('/');
  const right = b.contract.path.split('/');
  for (const [i, segment] of left.entries()) {
    const leftParam = segment.startsWith(PARAM_MARK);
    const rightParam = right[i]?.startsWith(PARAM_MARK);
    if (rightParam !== undefined && leftParam !== rightParam) {
      return leftParam ? 1 : -1;
    }
  }
  return 0;
}

/** Steps 3–8 of the pipeline (D2), for one matched entry. */
async function serve(
  deps: ApiDeps,
  route: BoundRoute,
  c: Context,
): Promise<Response> {
  const { contract } = route;
  const ids: { route: string; org?: OrgId; principalKind?: PrincipalKind } = {
    route: contract.operationId,
  };
  const fail = (f: ApiFailure): Response => errorResponse(f, deps.log, ids);
  try {
    let caller: Caller | undefined;
    let sessionHash: string | undefined;
    let credentialKind: HandlerContext<
      unknown,
      unknown,
      unknown
    >['credentialKind'];
    let refreshCaller: HandlerContext<
      unknown,
      unknown,
      unknown
    >['refreshCaller'];
    let recheckBound: HandlerContext<unknown, unknown, unknown>['recheckBound'];
    if (contract.public !== true) {
      const resolved = await resolveCaller(sessionDepsOf(deps), {
        authorization: c.req.header('authorization'),
        cookie: c.req.header('cookie'),
        method: contract.method,
        origin: c.req.header('origin'),
      });
      if (!resolved.ok) return fail(resolved.error);
      caller = resolved.value.caller;
      sessionHash = resolved.value.sessionHash;
      credentialKind = resolved.value.via;
      refreshCaller = resolved.value.refresh;
      recheckBound =
        resolved.value.via === 'session'
          ? deps.login.SESSION_RECHECK_MS
          : undefined;
      ids.principalKind = caller.principal.kind;
    }

    const rawParams = c.req.param();
    const params = contract.params.safeParse(rawParams);
    if (!params.success) return fail(INVALID);
    let org: OrgId | undefined;
    const rawOrg = rawParams[ORG_PARAM];
    if (rawOrg !== undefined) {
      const parsedOrg = parseOrgId(rawOrg);
      if (!parsedOrg.ok) return fail(INVALID);
      org = parsedOrg.value;
      ids.org = org;
    }

    if (caller !== undefined && contract.check !== undefined) {
      const checked = await runCheck(
        contract.check,
        caller,
        org,
        rawParams,
        deps.authz,
        deps.authzAdmin,
      );
      if (!checked.ok) return fail(checked.error);
    }

    const query = contract.query?.safeParse(c.req.query());
    if (query?.success === false) return fail(INVALID);
    let body: unknown;
    if (contract.body !== undefined) {
      const json: unknown = await c.req.json().catch(() => undefined);
      const parsedBody = contract.body.safeParse(json);
      if (!parsedBody.success) return fail(INVALID);
      body = parsedBody.data;
    }

    const headers = new Headers();
    const handlerCtx: HandlerContext<unknown, unknown, unknown> = {
      caller,
      org,
      params: params.data,
      query: query?.data,
      body,
      signal: c.req.raw.signal,
      sessionHash,
      setCookie: (value) => {
        headers.append('set-cookie', value);
      },
      credentialKind,
      refreshCaller,
      recheckBound,
      lastEventIdHeader: c.req.header('last-event-id'),
    };
    if (route.streamHandle !== undefined) {
      const streamed = await route.streamHandle(handlerCtx);
      if (!streamed.ok) return fail(streamed.error);
      for (const value of headers.getSetCookie()) {
        c.header('set-cookie', value, { append: true });
      }
      return streamSSE(c, async (stream) => {
        try {
          await streamed.value((text) => stream.write(text), c.req.raw.signal);
        } catch {
          deps.log.error(ids, 'stream body failed');
        }
      });
    }
    const result = await route.handle(handlerCtx);
    if (!result.ok) return fail(result.error);
    if (contract.redirect !== undefined) {
      if (!(result.value instanceof URL)) return fail(apiInternal);
      headers.set('location', result.value.toString());
      return new Response(null, { status: contract.redirect, headers });
    }
    const response = contract.response?.safeParse(result.value);
    if (response?.success !== true) return fail(apiInternal);
    return Response.json(response.data, { headers });
  } catch (cause) {
    deps.log.error({ ...ids, err: cause }, 'api handler threw');
    return fail(apiInternal);
  }
}

/** The route list on Hono under `/api/v1`, in the order of D2. Any throw is `internal`. */
export function createApiApp(
  deps: ApiDeps,
  routes: readonly BoundRoute[],
): { readonly fetch: (req: Request) => Promise<Response> } {
  const app = new Hono();
  const unmatched = (f: ApiFailure): Response =>
    errorResponse(f, deps.log, { route: UNMATCHED });
  app.use(
    bodyLimit({
      maxSize: deps.config.API_BODY_MAX_BYTES,
      onError: () => unmatched(TOO_LARGE),
    }),
  );
  for (const route of [...routes].sort(literalFirst)) {
    app.on(route.contract.method, PREFIX + route.contract.path, (c) =>
      serve(deps, route, c),
    );
  }
  app.notFound(() => unmatched(apiNotFound));
  app.onError(() => unmatched(apiInternal));
  return { fetch: async (req) => app.fetch(req) };
}
