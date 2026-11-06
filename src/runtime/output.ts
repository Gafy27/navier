import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { JsonValueSchema } from './request-context.ts';

/** What reaches the model, and the stored full result when it was cut. */
export interface ToolOutput {
  readonly modelText: string;
  readonly truncated: boolean;
  readonly objectId: string | null;
}

/** Stores the full bytes and returns the object id. */
export type StoreObject = (bytes: Uint8Array) => Promise<string>;

/** `text` cut at a code-point boundary to at most `max` UTF-8 bytes. */
function cutUtf8(text: string, max: number): string {
  if (Buffer.byteLength(text, 'utf8') <= max) return text;
  const parts: string[] = [];
  let used = 0;
  for (const codePoint of text) {
    const size = Buffer.byteLength(codePoint, 'utf8');
    if (used + size > max) break;
    used += size;
    parts.push(codePoint);
  }
  return parts.join('');
}

/**
 * The model-facing output of a tool result (D4). `invalid_argument` when `value`
 * is not plain JSON. A result over `maxBytes` is stored whole through `store`; the
 * text is a prefix and the marker, or the marker alone when the cap cannot hold it.
 */
export async function toOutput(
  value: unknown,
  maxBytes: number,
  store: StoreObject,
): Promise<Result<ToolOutput>> {
  let json: unknown;
  try {
    json = JSON.stringify(value);
  } catch {
    return err(appError(ErrorCode.invalid_argument, 'result is not JSON'));
  }
  if (typeof json !== 'string' || !JsonValueSchema.safeParse(value).success) {
    return err(appError(ErrorCode.invalid_argument, 'result is not JSON'));
  }
  const bytes = Buffer.from(json, 'utf8');
  if (bytes.length <= maxBytes) {
    return ok({ modelText: json, truncated: false, objectId: null });
  }
  const objectId = await store(bytes);
  const marker = `[truncated: ${String(bytes.length)} bytes; object ${objectId}]`;
  const room = maxBytes - Buffer.byteLength(marker, 'utf8');
  return ok({
    modelText: room > 0 ? cutUtf8(json, room) + marker : marker,
    truncated: true,
    objectId,
  });
}
