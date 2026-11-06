import type { Migration } from '../db/index.ts';
import { up as modelPolicy } from './migrations/03_0003_model_policy.ts';

/** The models unit's migrations, in name order. */
export const modelsMigrations: readonly Migration[] = [
  { name: '03_0003_model_policy', up: modelPolicy },
];
