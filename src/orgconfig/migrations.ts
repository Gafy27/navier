import type { Migration } from '../db/index.ts';
import { up as orgConfig } from './migrations/07_0001_org_config.ts';
import { up as orgProvider } from './migrations/07_0002_org_provider.ts';
import { up as orgProviderKey } from './migrations/07_0003_org_provider_key.ts';
import { up as orgConfigStreamFields } from './migrations/07_0004_org_config_stream_fields.ts';

/** The orgconfig unit's migrations, in name order. */
export const orgconfigMigrations: readonly Migration[] = [
  { name: '07_0001_org_config', up: orgConfig },
  { name: '07_0002_org_provider', up: orgProvider },
  { name: '07_0003_org_provider_key', up: orgProviderKey },
  { name: '07_0004_org_config_stream_fields', up: orgConfigStreamFields },
];
