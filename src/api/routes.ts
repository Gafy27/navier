import type { ApiDeps } from './adapter/app.ts';
import type { BoundRoute } from './adapter/route.ts';
import { agents } from './routes/agents/handler.ts';
import { auth } from './routes/auth/handler.ts';
import { authz } from './routes/authz/handler.ts';
import { chat } from './routes/chat/handler.ts';
import { config } from './routes/config/handler.ts';
import { platform } from './routes/platform/handler.ts';
import { stream } from './routes/stream/handler.ts';
import { tools } from './routes/tools/handler.ts';

/** Every area's bound routes. Each program appends its own. */
export function routeList(deps: ApiDeps): readonly BoundRoute[] {
  return [
    ...platform(deps),
    ...auth(deps),
    ...authz(deps),
    ...agents(deps),
    ...chat(deps),
    ...stream(deps),
    ...tools(deps),
    ...config(deps),
  ];
}
