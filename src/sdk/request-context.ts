import { parseJsonObject } from '../index.ts';
import type { JsonValue } from '../index.ts';
import { ORG_ID_KEY, PRINCIPAL_ID_KEY } from '../runtime/index.ts';
import { invalidArgument, SdkError } from './errors.ts';

export { ORG_ID_KEY, PRINCIPAL_ID_KEY };

const REQUEST_CONTEXT_SUBJECT = 'requestContext';

function checkedJson(
  values: Record<string, unknown>,
): Record<string, JsonValue> {
  const parsed = parseJsonObject(values, REQUEST_CONTEXT_SUBJECT);
  if (!parsed.ok) throw new SdkError(parsed.error);
  return parsed.value;
}

/** Mastra's `RequestContext`, with a `set` that refuses what is not JSON. */
export class RequestContext {
  readonly #values: Map<string, JsonValue>;

  constructor(initial: Record<string, unknown> = {}) {
    this.#values = new Map(Object.entries(checkedJson(initial)));
  }

  get(key: string): JsonValue | undefined {
    return this.#values.get(key);
  }

  set(key: string, value: unknown): void {
    const stored = checkedJson({ [key]: value })[key];
    if (stored === undefined) throw invalidArgument(key, 'not plain JSON');
    this.#values.set(key, stored);
  }

  has(key: string): boolean {
    return this.#values.has(key);
  }

  delete(key: string): boolean {
    return this.#values.delete(key);
  }

  all(): Record<string, JsonValue> {
    return this.toJSON();
  }

  toJSON(): Record<string, JsonValue> {
    return structuredClone(Object.fromEntries(this.#values));
  }
}
