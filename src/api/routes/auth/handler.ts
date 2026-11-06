import { appError, err, ErrorCode, ok } from '../../../index.ts';
import { PrincipalKind } from '../../../identity/index.ts';
import { sessionDepsOf } from '../../adapter/app.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { unauthenticated } from '../../adapter/errors.ts';
import { bind } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import {
  clearedSessionCookie,
  endSession,
  sessionCookie,
} from '../../adapter/session.ts';
import {
  beginLogin,
  finishLogin,
  parseHandoff,
  redeemHandoff,
} from './login.ts';
import { callback, handoff, login, logout, me } from './routes.ts';

export function auth(deps: ApiDeps): BoundRoute[] {
  return [
    bind(login, async ({ query }) => {
      const parsed = parseHandoff(query);
      if (!parsed.ok) return parsed;
      const begun = await beginLogin(
        deps.db,
        deps.oidc,
        deps.login,
        parsed.value,
      );
      return begun.ok ? ok(begun.value.location) : begun;
    }),
    bind(callback, async ({ query, setCookie }) => {
      const { state, code } = query;
      if (state === undefined || code === undefined) {
        return unauthenticated();
      }
      const finished = await finishLogin(sessionDepsOf(deps), { state, code });
      if (!finished.ok) return finished;
      const result = finished.value;
      if (result.kind === 'handoff') return ok(result.location);
      setCookie(sessionCookie(result.sessionId));
      return ok(new URL(new URL(deps.login.IDP_REDIRECT_URL).origin));
    }),
    bind(handoff, async ({ body }) => {
      const redeemed = await redeemHandoff(sessionDepsOf(deps), body);
      return redeemed.ok ? ok({ session: redeemed.value.session }) : redeemed;
    }),
    bind(logout, async ({ sessionHash, setCookie }) => {
      if (sessionHash === undefined) {
        return err(
          appError(ErrorCode.invalid_argument, 'logout needs a session'),
        );
      }
      const ended = await endSession(deps.db, sessionHash);
      if (!ended.ok) return ended;
      setCookie(clearedSessionCookie());
      return ok({});
    }),
    bind(me, ({ caller }) => {
      const internal = err(appError(ErrorCode.internal, 'internal error'));
      if (caller === undefined) return Promise.resolve(internal);
      const { id, kind } = caller.principal;
      if (kind === PrincipalKind.agent) return Promise.resolve(internal);
      return Promise.resolve(ok({ principal: id, kind }));
    }),
  ];
}
