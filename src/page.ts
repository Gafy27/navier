import { appError, ErrorCode } from './errors.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/** A page size: an integer of at least 1. */
export function requirePageLimit(limit: number): Result<void> {
  if (!Number.isInteger(limit) || limit < 1) {
    return err(appError(ErrorCode.invalid_argument, 'invalid limit'));
  }
  return ok(undefined);
}
