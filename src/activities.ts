import { runtimeActivities } from './runner/temporal/activities.ts';
import type { RuntimeActivityDeps } from './runner/temporal/activities.ts';

// Composition root for activities. Each phase spreads its own in.
export function activities(deps: RuntimeActivityDeps) {
  return { ...runtimeActivities(deps) };
}
