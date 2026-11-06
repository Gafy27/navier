import { z } from '../index.ts';

/** Service fields of the turn runtime. Each is required; there is no fallback. */
export const RuntimeConfigSchema = z.object({
  MODEL_CALL_TIMEOUT_MS: z.number().int().min(1),
  MODEL_ATTEMPTS: z.number().int().min(1),
  TOOL_CALL_TIMEOUT_MS: z.number().int().min(1),
  STORE_CALL_TIMEOUT_MS: z.number().int().min(1),
  REAPER_INTERVAL_MS: z.number().int().min(1),
  REAPER_BATCH_SIZE: z.number().int().min(1),
  STREAM_SWEEP_INTERVAL_MS: z.number().int().min(1),
  STREAM_SWEEP_BATCH_SIZE: z.number().int().min(1),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
