import { z } from '../index.ts';

const namespacePattern = /^[a-z0-9-]+$/u;
const serviceClaimPattern = /^[^=\s]+=\S+$/u;
const forbiddenAlgorithm = /^(none|hs\d+)$/iu;

const algorithms = z
  .string()
  .transform((raw) => raw.split(',').map((a) => a.trim()))
  .refine((list) => list.every((a) => a !== '' && !forbiddenAlgorithm.test(a)));

/** The caller variables. Names and rules are authz-api's, so one deployment sets one value for both. */
export const CallerConfigSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    IDP_ISSUER: z.string().min(1),
    IDP_AUDIENCE: z.string().min(1),
    IDP_JWKS_URI: z.url(),
    IDP_ALGORITHMS: algorithms,
    IDP_JWKS_TIMEOUT_MS: z.number().int().min(1),
    IDP_CLOCK_TOLERANCE_S: z.number().int().min(0).max(300),
    PRINCIPAL_NAMESPACE: z.string().regex(namespacePattern),
    SERVICE_SUBJECT_CLAIM: z.string().regex(serviceClaimPattern).optional(),
    SERVICE_SUBJECT_SUFFIX: z.string().min(1).optional(),
  })
  .refine(
    (c) =>
      (c.SERVICE_SUBJECT_CLAIM === undefined) !==
      (c.SERVICE_SUBJECT_SUFFIX === undefined),
    { path: ['SERVICE_SUBJECT_CLAIM'] },
  )
  .refine(
    (c) =>
      c.NODE_ENV === 'test' || new URL(c.IDP_JWKS_URI).protocol === 'https:',
    { path: ['IDP_JWKS_URI'] },
  );

export type CallerConfig = z.infer<typeof CallerConfigSchema>;
