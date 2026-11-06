import { createHash } from 'node:crypto';
import type { AgentDefinition } from './document.ts';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortKeys(item));
  if (typeof value !== 'object' || value === null) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    out[key] = sortKeys(source[key]);
  }
  return out;
}

/** Lowercase hex SHA-256 of `value`, keys sorted at every depth, array order kept. */
export function canonicalHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortKeys(value)))
    .digest('hex');
}

export function definitionHash(def: AgentDefinition): string {
  return canonicalHash(def);
}
