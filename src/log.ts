import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';
import type { CoreConfig } from './config.ts';

export type { Logger };

/** Replaces every redacted value. */
export const REDACTED = '[REDACTED]';

const MAX_DEPTH = 16;
const EXACT_KEYS = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'claims',
  'databaseurl',
]);
const KEY_SUFFIXES = [
  'token',
  'secret',
  'password',
  'apikey',
  'privatekey',
  'credentials',
  'dsn',
  'connectionstring',
];

function isSecretKey(key: string): boolean {
  const name = key.toLowerCase().replace(/[-_]/g, '');
  return (
    EXACT_KEYS.has(name) || KEY_SUFFIXES.some((suffix) => name.endsWith(suffix))
  );
}

function redact(
  value: unknown,
  depth: number,
  ancestors: readonly object[],
): unknown {
  if (typeof value !== 'object' || value === null || value instanceof Date)
    return value;
  if (depth >= MAX_DEPTH || ancestors.includes(value)) return REDACTED;
  const next = [...ancestors, value];
  if (value instanceof Error)
    return redact(pino.stdSerializers.err(value), depth, ancestors);
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => redact(item, depth + 1, next));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSecretKey(key) ? REDACTED : redact(child, depth + 1, next),
    ]),
  );
}

/**
 * Builds a pino logger whose output is redacted by key name at any depth.
 * `destination` is for tests; production writes to stdout.
 */
export function createLogger(
  level: CoreConfig['LOG_LEVEL'],
  destination?: DestinationStream,
): Logger {
  const options = {
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      censor: REDACTED,
    },
    formatters: {
      log: (obj: object) => redact(obj, 0, []) as Record<string, unknown>,
    },
    serializers: { err: (err: unknown) => redact(err, 0, []) },
  };
  return destination === undefined ? pino(options) : pino(options, destination);
}
