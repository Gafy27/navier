import { coreMigrations } from './db/index.ts';
import type { Migration } from './db/index.ts';
import { agentsMigrations } from './agents/index.ts';
import { apiMigrations } from './api/index.ts';
import { catalogMigrations } from './catalog/index.ts';
import { identityMigrations } from './identity/index.ts';
import { modelsMigrations } from './models/index.ts';
import { orgconfigMigrations } from './orgconfig/index.ts';
import { runtimeMigrations } from './runtime/index.ts';

/** Every unit's migrations. Each phase adds one spread. */
export const migrations: readonly Migration[] = [
  ...coreMigrations,
  ...identityMigrations,
  ...catalogMigrations,
  ...modelsMigrations,
  ...agentsMigrations,
  ...runtimeMigrations,
  ...orgconfigMigrations,
  ...apiMigrations,
];
