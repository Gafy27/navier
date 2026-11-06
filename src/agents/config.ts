import { z } from '../index.ts';

export { pauseTimeoutSeconds } from './limits.ts';

/** The five ceilings moved to the org snapshot. */
export const AgentsConfigSchema = z.object({});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

/** Empty config: ceilings live on the org snapshot. */
export const emptyAgentsConfig: AgentsConfig = {};
