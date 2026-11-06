import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';

/** One GET with the caller's signal; status only, body discarded (PD9). */
export async function verifyKeyFetch(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Result<void>> {
  let status: number;
  try {
    const response = await fetch(url, { headers, redirect: 'error', signal });
    await response.body?.cancel();
    status = response.status;
  } catch {
    return err(appError(ErrorCode.unavailable, 'key: unverified'));
  }
  if (status >= 200 && status < 300) return ok(undefined);
  if (status === 401 || status === 403) {
    return err(appError(ErrorCode.invalid_argument, 'key: rejected'));
  }
  return err(appError(ErrorCode.unavailable, 'key: unverified'));
}
