import { z } from '../../index.ts';

/** The API process variables (PD5). Required except the verify timeout (one fallback, P13.4 D5) and the directory lookup cap (absent when unset, D6). */
export const ApiConfigSchema = z.object({
  API_HOST: z.string().min(1),
  API_PORT: z.number().int().min(1).max(65535),
  API_BODY_MAX_BYTES: z.number().int().min(1),
  PROVIDER_VERIFY_TIMEOUT_MS: z.number().int().min(1).default(10_000),
  /** Rows per stream read (P13.6 PD5). Required, no fallback. */
  STREAM_READ_BATCH_SIZE: z.number().int().min(1),
  /** Distinct user lookups per grant write (D6). Absent when unset; no fallback. */
  IDP_DIRECTORY_LOOKUP_MAX: z.number().int().min(1).optional(),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;
