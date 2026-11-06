import { z } from '../index.ts';
import { pauseTimeoutSchema, pauseTimeoutSeconds } from '../orgconfig/index.ts';

export { pauseTimeoutSchema, pauseTimeoutSeconds };

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_RECOVERIES = 3;

const positiveInt = z.number().int().min(1);
const nonNegativeInt = z.number().int().min(0);

/** An omitted maxToolCallsPerStep stores toolCallConcurrency. Snapshot fields stay optional until save fills them. */
export const LimitsSchema = z
  .strictObject({
    maxSteps: positiveInt.optional(),
    toolCallConcurrency: positiveInt.default(DEFAULT_CONCURRENCY),
    maxToolCallsPerStep: positiveInt.optional(),
    pauseTimeout: pauseTimeoutSchema.optional(),
    maxTraceOutputBytes: positiveInt.optional(),
    maxToolsPerVersion: nonNegativeInt.optional(),
    maxFallbacks: nonNegativeInt.optional(),
    maxRecoveries: z.number().int().min(0).default(DEFAULT_RECOVERIES),
  })
  .transform((limits) => ({
    ...limits,
    maxToolCallsPerStep:
      limits.maxToolCallsPerStep ?? limits.toolCallConcurrency,
  }));

export type Limits = z.output<typeof LimitsSchema>;
