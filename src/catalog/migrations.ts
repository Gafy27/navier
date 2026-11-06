import type { Migration } from '../db/index.ts';
import { up as toolEntry } from './migrations/03_0001_tool_entry.ts';
import { up as toolStatus } from './migrations/03_0002_tool_status.ts';
import { up as toolServing } from './migrations/06_0001_tool_serving.ts';
/** The catalog unit's migrations, in name order. */
export const catalogMigrations: readonly Migration[] = [
  { name: '03_0001_tool_entry', up: toolEntry },
  { name: '03_0002_tool_status', up: toolStatus },
  { name: '06_0001_tool_serving', up: toolServing },
];
