import type { Migration } from '../../db/index.ts';
import { up as session } from './migrations/13_0001_session.ts';
import { up as directory } from './migrations/13_0002_directory.ts';
import { up as loginHandoff } from './migrations/13_0003_login_handoff.ts';

/** The api unit's migrations, in name order. */
export const apiMigrations: readonly Migration[] = [
  { name: '13_0001_session', up: session },
  { name: '13_0002_directory', up: directory },
  { name: '13_0003_login_handoff', up: loginHandoff },
];
