import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Logger, Result } from '../index.ts';
import type { ReadinessProbe } from '../db/index.ts';
import type { CallerConfig } from './caller-config.ts';
import { Credential } from './credential.ts';
import { parsePrincipalId, PrincipalKind } from './principal.ts';
import type { Principal } from './principal.ts';

/** A verified caller: a person or service principal and the token to forward. */
export interface Caller {
  readonly principal: Principal;
  readonly credential: Credential;
  readonly expiresAt: Date;
}

export interface CallerVerifier {
  readonly verify: (
    authorization: string | undefined,
  ) => Promise<Result<Caller>>;
}

const bearer = /^Bearer (\S+)$/iu;
const UNAUTHENTICATED = 'authentication failed';
const UNAVAILABLE = 'identity provider unavailable';

const jwksChecks = new WeakMap<
  CallerVerifier,
  (signal: AbortSignal) => Promise<boolean>
>();

function rejected(): Result<never> {
  return err(appError(ErrorCode.unauthenticated, UNAUTHENTICATED));
}

/** The IdP could not be asked, as opposed to the token being wrong. */
function isIdpFailure(e: unknown): boolean {
  if (!(e instanceof errors.JOSEError)) return true;
  return (
    e instanceof errors.JWKSTimeout ||
    e instanceof errors.JWKSInvalid ||
    e.code === errors.JOSEError.code
  );
}

function serviceKind(
  config: CallerConfig,
): (sub: string, claims: Record<string, unknown>) => boolean {
  const suffix = config.SERVICE_SUBJECT_SUFFIX;
  if (suffix !== undefined) return (sub) => sub.endsWith(suffix);
  const pair = config.SERVICE_SUBJECT_CLAIM ?? '';
  const at = pair.indexOf('=');
  const name = pair.slice(0, at);
  const value = pair.slice(at + 1);
  return (_sub, claims) => claims[name] === value;
}

/** Verifies bearer tokens locally against the IdP's JWKS. No network call at construction. */
export function createCallerVerifier(
  config: CallerConfig,
  logger: Logger,
): CallerVerifier {
  const jwksUri = new URL(config.IDP_JWKS_URI);
  const jwks = createRemoteJWKSet(jwksUri, {
    timeoutDuration: config.IDP_JWKS_TIMEOUT_MS,
  });
  const isService = serviceKind(config);

  const verifier: CallerVerifier = {
    verify: async (authorization) => {
      const token =
        authorization === undefined ? null : bearer.exec(authorization)?.[1];
      if (token === null || token === undefined) return rejected();
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: config.IDP_ISSUER,
          audience: config.IDP_AUDIENCE,
          algorithms: config.IDP_ALGORITHMS,
          clockTolerance: config.IDP_CLOCK_TOLERANCE_S,
          requiredClaims: ['exp', 'sub'],
        });
        const sub = payload.sub ?? '';
        const id = parsePrincipalId(
          `user:${config.PRINCIPAL_NAMESPACE}~${sub}`,
        );
        if (!id.ok) return rejected();
        const kind = isService(sub, payload)
          ? PrincipalKind.service
          : PrincipalKind.person;
        const exp = payload.exp;
        if (typeof exp !== 'number') return rejected();
        return ok({
          principal: { kind, id: id.value },
          credential: new Credential(token),
          expiresAt: new Date(exp * 1000),
        });
      } catch (e) {
        const code = e instanceof errors.JOSEError ? e.code : 'ERR_FETCH';
        if (isIdpFailure(e)) {
          logger.warn({ code }, 'identity provider unreachable');
          return err(appError(ErrorCode.unavailable, UNAVAILABLE));
        }
        logger.debug({ code }, 'caller token rejected');
        return rejected();
      }
    },
  };

  jwksChecks.set(verifier, async (signal) => {
    const res = await fetch(jwksUri, {
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(config.IDP_JWKS_TIMEOUT_MS),
      ]),
    });
    return res.ok;
  });
  return verifier;
}

/** Answers yes when the JWKS endpoint answers within `IDP_JWKS_TIMEOUT_MS`. Any failure answers no. */
export function callerProbe(verifier: CallerVerifier): ReadinessProbe {
  return {
    name: 'idp',
    check: async (signal) => {
      const reach = jwksChecks.get(verifier);
      if (reach === undefined || signal.aborted) return false;
      try {
        return await reach(signal);
      } catch {
        return false;
      }
    },
  };
}
