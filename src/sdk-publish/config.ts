import { CoreConfigSchema, err, loadConfig, ok, z } from '../index.ts';
import type { ConfigError, Result } from '../index.ts';
import { DatabaseConfigSchema } from '../db/index.ts';
import { AgentsConfigSchema } from '../agents/index.ts';
import { CatalogConfigSchema } from '../catalog/index.ts';
import { AuthzConfigSchema, CallerConfigSchema } from '../identity/index.ts';

/**
 * Every variable a register or publish run reads. `.shape` drops object-level
 * refinements, so `loadPublishConfig` also loads the schemas that have them.
 */
export const SdkPublishConfigSchema = z
  .object({ LOG_LEVEL: CoreConfigSchema.shape.LOG_LEVEL })
  .extend(DatabaseConfigSchema.shape)
  .extend(CallerConfigSchema.shape)
  .extend(AuthzConfigSchema.shape)
  .extend(CatalogConfigSchema.shape)
  .extend(AgentsConfigSchema.shape)
  .extend({
    REQUEST_PAGE_SIZE: z.number().int().min(1),
  });

export type SdkPublishConfig = z.infer<typeof SdkPublishConfigSchema>;

export type PublishEnv = Readonly<Record<string, string | undefined>>;

const refinedSchemas = [CallerConfigSchema, AuthzConfigSchema] as const;

/** Loads the merged schema, then each refined schema whole so its refinements run. */
export function loadPublishConfig(
  env: PublishEnv,
): Result<SdkPublishConfig, ConfigError> {
  const merged = loadConfig(SdkPublishConfigSchema, env);
  if (!merged.ok) return merged;
  for (const schema of refinedSchemas) {
    const part = loadConfig(schema, env);
    if (!part.ok) return err(part.error);
  }
  return ok(merged.value);
}
