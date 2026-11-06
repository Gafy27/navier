/** The closed set of error codes. A ninth code is a major API change. */
export const ErrorCode = {
  invalid_argument: 'invalid_argument',
  unauthenticated: 'unauthenticated',
  permission_denied: 'permission_denied',
  not_found: 'not_found',
  already_exists: 'already_exists',
  aborted: 'aborted',
  unavailable: 'unavailable',
  internal: 'internal',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** A plain-value error. `message` is safe to show a client; `cause` is server-only. */
export interface AppError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

/** Builds an `AppError`. The `cause` key is absent when `cause` is undefined. */
export function appError(
  code: ErrorCode,
  message: string,
  cause?: unknown,
): AppError {
  return cause === undefined ? { code, message } : { code, message, cause };
}
