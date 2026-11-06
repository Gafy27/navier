import { appError, ErrorCode } from '../index.ts';
import type { AppError } from '../index.ts';

/** What every SDK function throws. `message` names a path or key, never a value. No `cause`. */
export class SdkError extends Error {
  readonly code: ErrorCode;

  constructor(error: AppError) {
    super(error.message);
    this.name = new.target.name;
    this.code = error.code;
  }
}

/** `invalid_argument` naming `path`. */
export function invalidArgument(path: string, reason: string): SdkError {
  return new SdkError(
    appError(ErrorCode.invalid_argument, `${path}: ${reason}`),
  );
}
