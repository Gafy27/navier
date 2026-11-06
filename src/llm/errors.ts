import { APICallError } from 'ai';
import { appError, ErrorCode } from '../index.ts';
import type { AppError } from '../index.ts';

const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

function isAbort(e: unknown): boolean {
  return (
    e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
  );
}

/**
 * Sorts a failed provider call into the D3 classes. The message is fixed text
 * and the cause is dropped: the SDK error holds request values.
 */
export function mapProviderError(e: unknown): AppError {
  if (isAbort(e)) return appError(ErrorCode.unavailable, 'model call aborted');
  if (!APICallError.isInstance(e)) {
    return appError(ErrorCode.internal, 'model call failed');
  }
  const status = e.statusCode;
  if (status === undefined) {
    return appError(ErrorCode.unavailable, 'model provider unreachable');
  }
  const text = `model provider answered HTTP ${String(status)}`;
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return appError(ErrorCode.permission_denied, text);
  }
  if (
    status === HTTP_REQUEST_TIMEOUT ||
    status === HTTP_TOO_MANY_REQUESTS ||
    status >= HTTP_SERVER_ERROR
  ) {
    return appError(ErrorCode.unavailable, text);
  }
  return appError(ErrorCode.invalid_argument, text);
}
