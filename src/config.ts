import { z } from 'zod';
import { appError, ErrorCode } from './errors.ts';
import type { AppError } from './errors.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/** An `AppError` whose code is `invalid_argument`. */
export type ConfigError = AppError & { readonly code: 'invalid_argument' };

/** The core variables. Each fallback is written here and nowhere else. */
export const CoreConfigSchema = z.object({
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SHUTDOWN_TIMEOUT_MS: z.number().int().min(1),
  START_GRACE_MS: z.number().int().min(1).default(60000),
  MAX_HISTORY_LENGTH: z.number().int().min(1).optional(),
});

export type CoreConfig = z.infer<typeof CoreConfigSchema>;

/** The database variables. `DATABASE_URL` is a secret and is never logged. */
export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_POOL_MAX: z.number().int().min(1).default(10),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

/** The health variables. The probe timeout must stay below the orchestrator's readiness timeout. */
export const HealthConfigSchema = z.object({
  HEALTH_HOST: z.string().min(1),
  HEALTH_PORT: z.number().int().min(1).max(65535),
  PROBE_TIMEOUT_MS: z.number().int().min(1).default(2000),
});

export type HealthConfig = z.infer<typeof HealthConfigSchema>;

/** The Temporal variables. Each is required; there is no fallback. */
export const TemporalConfigSchema = z.object({
  TEMPORAL_ADDRESS: z.string().min(1),
  TEMPORAL_NAMESPACE: z.string().min(1),
  TEMPORAL_TASK_QUEUE: z.string().min(1),
});

export type TemporalConfig = z.infer<typeof TemporalConfigSchema>;

function isNumeric(field: z.core.$ZodType): boolean {
  let def = field._zod.def;
  while ('innerType' in def) {
    def = (def.innerType as z.core.$ZodType)._zod.def;
  }
  return def.type === 'number';
}

/**
 * Parses a string map against `schema`. Returns the declared keys only, or a
 * `ConfigError` naming the bad variables. Never echoes a value.
 */
export function loadConfig<S extends z.ZodObject>(
  schema: S,
  env: Readonly<Record<string, string | undefined>>,
): Result<z.infer<S>, ConfigError> {
  const projected: Record<string, string | number> = {};
  for (const [key, field] of Object.entries<z.core.$ZodType>(schema.shape)) {
    const raw = env[key];
    if (raw === undefined || raw === '') continue;
    const n = Number(raw);
    projected[key] = isNumeric(field) && Number.isFinite(n) ? n : raw;
  }

  const parsed = schema.safeParse(projected);
  if (parsed.success) return ok(parsed.data);

  const names = new Set<string>();
  for (const issue of parsed.error.issues) {
    const name = String(issue.path[0]);
    names.add(`${name} (${name in projected ? 'invalid' : 'missing'})`);
  }
  const message = `invalid configuration: ${[...names].sort().join(', ')}`;
  return err(appError(ErrorCode.invalid_argument, message) as ConfigError);
}
