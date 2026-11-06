import { appError, ErrorCode } from './errors.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import { z } from 'zod';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const plainObject = z.custom<PlainObject>((value) => isPlainObject(value));

export type JsonValue =
  null | boolean | string | number | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

/** JSON values. `z.number()` already rejects `NaN` and `Infinity`. */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.string(),
    z.number(),
    z.array(JsonValueSchema),
    plainObject.pipe(z.record(z.string(), JsonValueSchema)),
  ]),
);

const JsonObjectSchema = plainObject.pipe(
  z.record(z.string(), JsonValueSchema),
);

/** Zod's record parse succeeds on a cycle and returns it. */
function cyclePath(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (seen.has(value)) return path;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const bad = cyclePath(item, `${path}[${String(index)}]`, seen);
        if (bad !== undefined) return bad;
      }
      return undefined;
    }
    for (const [key, member] of Object.entries(value)) {
      const bad = cyclePath(member, path === '' ? key : `${path}.${key}`, seen);
      if (bad !== undefined) return bad;
    }
    return undefined;
  } finally {
    seen.delete(value);
  }
}

function deepest(issue: z.core.$ZodIssue): PropertyKey[] {
  let best: PropertyKey[] = [...issue.path];
  if (issue.code !== 'invalid_union') return best;
  for (const group of issue.errors) {
    for (const child of group) {
      const full = [...issue.path, ...deepest(child)];
      if (full.length >= best.length) best = full;
    }
  }
  return best;
}

function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${String(segment)}]`;
      continue;
    }
    const text = typeof segment === 'symbol' ? 'symbol' : segment;
    out = out === '' ? text : `${out}.${text}`;
  }
  return out;
}

/**
 * A copy of a plain JSON object. `invalid_argument` names the first bad path
 * (`subject.a.b[2]`), never a value.
 */
export function parseJsonObject(
  raw: unknown,
  subject: string,
): Result<JsonObject> {
  const cycle = cyclePath(raw, '', new WeakSet());
  if (cycle !== undefined) {
    return err(
      appError(
        ErrorCode.invalid_argument,
        `${subject}.${cycle}: not plain JSON`,
      ),
    );
  }
  const parsed = JsonObjectSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const path = issue === undefined ? '' : formatPath(deepest(issue));
  const message =
    path === ''
      ? `${subject}: must be a plain JSON object`
      : `${subject}.${path}: not plain JSON`;
  return err(appError(ErrorCode.invalid_argument, message));
}
