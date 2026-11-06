import type { Migration } from '../db/index.ts';
import { up as agentPrincipal } from './migrations/02_0001_agent_principal.ts';
import { up as scopeRequest } from './migrations/02_0002_scope_request.ts';

/** The identity unit's migrations, in name order. */
export const identityMigrations: readonly Migration[] = [
  { name: '02_0001_agent_principal', up: agentPrincipal },
  { name: '02_0002_scope_request', up: scopeRequest },
];
