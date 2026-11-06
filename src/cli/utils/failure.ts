import type { ClientResult } from '../../client/index.ts';
import {
  ERROR_LINE_SEP,
  EXIT_FAIL,
  EXIT_OK,
  EXIT_USAGE,
  STREAM_FAILURE_NAME,
} from './constants.ts';
import { USAGE_PREFIX } from './copy.ts';

export { EXIT_FAIL, EXIT_OK, EXIT_USAGE } from './constants.ts';

/** A failure whose message is safe to print. It never carries a credential or file content (G5). */
export class CliFailure extends Error {}

/** A usage error. `runCli` exits 2; every other `CliFailure` exits 1 (B7, PD8). */
export class CliUsage extends CliFailure {}

export interface CliOut {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export function printCall(result: ClientResult<unknown>, out: CliOut): number {
  if (!result.ok) {
    out.stderr(`${result.error.type}${ERROR_LINE_SEP}${result.error.message}`);
    return EXIT_FAIL;
  }
  out.stdout(JSON.stringify(result.value));
  return EXIT_OK;
}

/** `StreamFailure` is not on the client entry, so match its name and `type` (PD8). */
function streamLine(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== STREAM_FAILURE_NAME)
    return undefined;
  if (!('type' in error) || typeof error.type !== 'string') return undefined;
  return `${error.type}${ERROR_LINE_SEP}${error.message}`;
}

export async function printStream(
  frames: AsyncIterable<unknown>,
  out: CliOut,
): Promise<number> {
  try {
    for await (const frame of frames) out.stdout(`${JSON.stringify(frame)}\n`);
    return EXIT_OK;
  } catch (cause) {
    const line = streamLine(cause);
    if (line === undefined) throw cause;
    out.stderr(line);
    return EXIT_FAIL;
  }
}

export function printUsage(error: CliUsage, out: CliOut): number {
  out.stderr(`${USAGE_PREFIX}${error.message}`);
  return EXIT_USAGE;
}
