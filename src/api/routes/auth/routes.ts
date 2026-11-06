import { z } from '../../../index.ts';
import {
  CheckKind,
  defineRoute,
  Method,
  RedirectStatus,
  RouteTag,
  WireType,
} from '../../adapter/route-types.ts';

export const login = defineRoute({
  operationId: 'login',
  summary: 'Redirects to the identity provider with state and PKCE',
  tag: RouteTag.enum.auth,
  errors: [WireType.enum.invalid_request, WireType.enum.internal],
  method: Method.enum.GET,
  path: '/auth/login',
  public: true,
  params: z.strictObject({}),
  query: z.object({
    return: z.url().optional(),
    handoff_challenge: z.string().length(43).optional(),
  }),
  redirect: RedirectStatus.enum.found,
});

export const callback = defineRoute({
  operationId: 'callback',
  summary: 'Exchanges the code and starts a browser session',
  tag: RouteTag.enum.auth,
  errors: [
    WireType.enum.unauthenticated,
    WireType.enum.unavailable,
    WireType.enum.internal,
  ],
  method: Method.enum.GET,
  path: '/auth/callback',
  public: true,
  params: z.strictObject({}),
  query: z.object({
    state: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
  }),
  redirect: RedirectStatus.enum.found,
});

export const handoff = defineRoute({
  operationId: 'handoff',
  summary: 'Redeems a one-time loopback code for the session id',
  tag: RouteTag.enum.auth,
  errors: [
    WireType.enum.unauthenticated,
    WireType.enum.invalid_request,
    WireType.enum.internal,
  ],
  method: Method.enum.POST,
  path: '/auth/handoff',
  public: true,
  params: z.strictObject({}),
  body: z.strictObject({
    handoff: z.string().min(1),
    verifier: z.string().min(43).max(128),
  }),
  response: z.strictObject({ session: z.string().startsWith('ses_') }),
});

export const logout = defineRoute({
  operationId: 'logout',
  summary: 'Ends the caller session',
  tag: RouteTag.enum.auth,
  errors: [
    WireType.enum.unauthenticated,
    WireType.enum.forbidden,
    WireType.enum.invalid_request,
    WireType.enum.unavailable,
  ],
  method: Method.enum.POST,
  path: '/auth/logout',
  check: { kind: CheckKind.enum.caller },
  params: z.strictObject({}),
  response: z.strictObject({}),
});

export const me = defineRoute({
  operationId: 'me',
  summary: 'The caller principal id and kind',
  tag: RouteTag.enum.auth,
  errors: [WireType.enum.unauthenticated, WireType.enum.unavailable],
  method: Method.enum.GET,
  path: '/auth/me',
  check: { kind: CheckKind.enum.caller },
  params: z.strictObject({}),
  response: z.strictObject({
    principal: z.string(),
    kind: z.enum(['person', 'service']),
  }),
});

export const authRoutes = { login, callback, handoff, logout, me } as const;
