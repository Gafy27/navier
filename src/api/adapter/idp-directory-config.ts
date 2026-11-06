import { z } from '../../index.ts';

const positive = z.number().int().min(1);

const SUBJECT = '{subject}';

const isHttps = (url: string) => new URL(url).protocol === 'https:';

const oneSubject = (url: string) => url.split(SUBJECT).length === 2;

/** Directory lookup variables (D7). Each required field has no fallback. */
export const IdpDirectoryConfigSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    IDP_DIRECTORY_USER_URL: z.url(),
    IDP_DIRECTORY_TOKEN_URL: z.url(),
    IDP_DIRECTORY_CLIENT_ID: z.string().min(1),
    IDP_DIRECTORY_CLIENT_SECRET_FILE: z.string().min(1),
    IDP_DIRECTORY_AUDIENCE: z.string().min(1).optional(),
    IDP_DIRECTORY_TIMEOUT_MS: positive,
  })
  .refine((c) => oneSubject(c.IDP_DIRECTORY_USER_URL), {
    path: ['IDP_DIRECTORY_USER_URL'],
  })
  .refine(
    (c) => (c.NODE_ENV === 'test' ? true : isHttps(c.IDP_DIRECTORY_TOKEN_URL)),
    { path: ['IDP_DIRECTORY_TOKEN_URL'] },
  )
  .refine(
    (c) => (c.NODE_ENV === 'test' ? true : isHttps(c.IDP_DIRECTORY_USER_URL)),
    { path: ['IDP_DIRECTORY_USER_URL'] },
  );

export type IdpDirectoryConfig = z.infer<typeof IdpDirectoryConfigSchema>;
