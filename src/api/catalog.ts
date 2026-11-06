import { agentsRoutes } from './routes/agents/routes.ts';
import { authRoutes } from './routes/auth/routes.ts';
import { authzRoutes } from './routes/authz/routes.ts';
import { chatRoutes } from './routes/chat/routes.ts';
import { configRoutes } from './routes/config/routes.ts';
import { platformRoutes } from './routes/platform/routes.ts';
import { streamRoutes } from './routes/stream/routes.ts';
import { toolsRoutes } from './routes/tools/routes.ts';

/** Every area's contracts, each key its `operationId`. Each program spreads its own. */
export const catalog = {
  ...platformRoutes,
  ...authRoutes,
  ...authzRoutes,
  ...agentsRoutes,
  ...chatRoutes,
  ...streamRoutes,
  ...toolsRoutes,
  ...configRoutes,
} as const;
