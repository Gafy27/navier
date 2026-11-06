import type { JsonValue } from '../index.ts';

const DROPPED_KEYS: ReadonlySet<string> = new Set([
  'instructions',
  'tools',
  'toolDefinitions',
  'system',
]);

function strip(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(strip);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !DROPPED_KEYS.has(key))
      .map(([key, member]) => [key, strip(member)]),
  );
}

/**
 * A copy of `event` without the keys that carry instructions or tool
 * definitions, at every depth (L1). The input is not mutated.
 */
export function redactEvent<T extends JsonValue>(event: T): T {
  return strip(event) as T;
}
