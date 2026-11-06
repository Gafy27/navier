import { appError, err, ErrorCode } from '../../index.ts';
import type { AppError, Logger } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import { DenyReason } from '../../identity/index.ts';
import type { Decision, PrincipalKind } from '../../identity/index.ts';
import { WireType } from './route-types.ts';

/** A failure a route returns. The two non-`ErrorCode` types are raised by the adapter and P13.5. */
export type ApiFailure =
  | AppError
  | {
      readonly type:
        | typeof WireType.enum.already_running
        | typeof WireType.enum.payload_too_large;
      readonly message: string;
    };

/** The only fields an error log line carries. Never a principal id, a header, or a claim. */
export interface LogIds {
  readonly route: string;
  readonly org?: OrgId;
  readonly principalKind?: PrincipalKind;
}

/** The D5 table. */
export const STATUS: Readonly<Record<WireType, number>> = {
  [WireType.enum.unauthenticated]: 401,
  [WireType.enum.forbidden]: 403,
  [WireType.enum.not_found]: 404,
  [WireType.enum.invalid_request]: 400,
  [WireType.enum.conflict]: 409,
  [WireType.enum.already_running]: 409,
  [WireType.enum.payload_too_large]: 413,
  [WireType.enum.unavailable]: 503,
  [WireType.enum.internal]: 500,
};

/** The one 401 every login and session path returns. */
export const unauthenticated = () =>
  err(appError(ErrorCode.unauthenticated, 'authentication failed'));

/** Shared route and adapter failures with one message each. */
export const apiInternal = appError(ErrorCode.internal, 'internal error');
export const apiNotFound = appError(ErrorCode.not_found, 'not found');
export const apiUnavailable = appError(
  ErrorCode.unavailable,
  'authz-api unavailable',
);

/** L4: store code to wire type. */
const WIRE_OF: Readonly<Record<ErrorCode, WireType>> = {
  invalid_argument: WireType.enum.invalid_request,
  unauthenticated: WireType.enum.unauthenticated,
  permission_denied: WireType.enum.forbidden,
  not_found: WireType.enum.not_found,
  already_exists: WireType.enum.conflict,
  aborted: WireType.enum.conflict,
  unavailable: WireType.enum.unavailable,
  internal: WireType.enum.internal,
};

export function toWire(f: ApiFailure): {
  readonly status: number;
  readonly type: WireType;
  readonly message: string;
} {
  const type = 'code' in f ? WIRE_OF[f.code] : f.type;
  return { status: STATUS[type], type, message: f.message };
}

/** L3: not visible is not found; no grant is forbidden; anything else but `unavailable` is internal. */
export function fromDecision(
  d: Extract<Decision, { allow: false }>,
): ApiFailure {
  switch (d.reason) {
    case DenyReason.not_visible:
      return appError(ErrorCode.not_found, 'not found');
    case DenyReason.no_grant:
      return appError(ErrorCode.permission_denied, 'forbidden');
    case DenyReason.unavailable:
      return appError(ErrorCode.unavailable, 'authorization unavailable');
    default:
      return appError(ErrorCode.internal, 'internal error');
  }
}

/** L4: the only writer of an error body. A `cause` never reaches the body or the log. */
export function errorResponse(
  f: ApiFailure,
  log: Logger,
  ids: LogIds,
): Response {
  const { status, type, message } = toWire(f);
  if (type === WireType.enum.internal)
    log.error({ ...ids, type, status }, 'api error');
  else log.info({ ...ids, type, status }, 'api error');
  return Response.json({ error: { type, message } }, { status });
}
