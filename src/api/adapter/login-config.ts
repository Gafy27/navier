import { z } from '../../index.ts';

const positive = z.number().int().min(1);

const isHttps = (url: string) => new URL(url).protocol === 'https:';

/** The login variables (PD3). Each is required; there is no fallback. */
export const LoginConfigSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    IDP_AUTHORIZE_URL: z.url(),
    IDP_TOKEN_URL: z.url(),
    IDP_CLIENT_ID: z.string().min(1),
    IDP_CLIENT_SECRET_FILE: z.string().min(1),
    IDP_REDIRECT_URL: z.url(),
    IDP_SCOPES: z.string().min(1),
    LOGIN_STATE_TTL_MS: positive,
    LOGIN_STATE_DELETE_MAX: positive,
    LOGIN_HANDOFF_TTL_MS: positive,
    SESSION_IDLE_MS: positive,
    SESSION_RECHECK_MS: positive,
  })
  .refine((c) => c.SESSION_RECHECK_MS < c.SESSION_IDLE_MS, {
    path: ['SESSION_RECHECK_MS'],
  })
  .refine((c) => (c.NODE_ENV === 'test' ? true : isHttps(c.IDP_TOKEN_URL)), {
    path: ['IDP_TOKEN_URL'],
  })
  .refine(
    (c) => (c.NODE_ENV === 'test' ? true : isHttps(c.IDP_AUTHORIZE_URL)),
    { path: ['IDP_AUTHORIZE_URL'] },
  );

export type LoginConfig = z.infer<typeof LoginConfigSchema>;
