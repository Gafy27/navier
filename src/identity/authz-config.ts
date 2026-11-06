import { z } from '../index.ts';

/** The authz-api client variables. `AUTHZ_CLIENT_SECRET_FILE` names a file; the secret is never in the environment. */
export const AuthzConfigSchema = z
  .object({
    AUTHZ_API_URL: z.url(),
    AUTHZ_TLS: z.string().optional(),
    AUTHZ_TIMEOUT_MS: z.number().int().min(1),
    /** Must equal authz-api's own `CHECK_MAX_ITEMS`. No default: a wrong value is a refused config. */
    AUTHZ_CHECK_MAX_ITEMS: z.number().int().min(1),
    AUTHZ_TOKEN_URL: z.url(),
    AUTHZ_CLIENT_ID: z.string().min(1),
    AUTHZ_CLIENT_SECRET_FILE: z.string().min(1),
    AUTHZ_AUDIENCE: z.string().min(1).optional(),
  })
  .refine(
    (c) =>
      c.AUTHZ_TLS === 'false' || new URL(c.AUTHZ_API_URL).protocol === 'https:',
    { path: ['AUTHZ_API_URL'] },
  );

export type AuthzConfig = z.infer<typeof AuthzConfigSchema>;
