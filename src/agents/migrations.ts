import type { Migration } from '../db/index.ts';
import { up as agent } from './migrations/03_0004_agent.ts';
import { up as agentVersion } from './migrations/03_0005_agent_version.ts';
import { up as agentHead } from './migrations/03_0006_agent_head.ts';
import { up as agentCreateKey } from './migrations/03_0007_agent_create_key.ts';
import { up as agentCreateKeySnapshot } from './migrations/07_0004_agent_create_key_snapshot.ts';
import { up as agentVersionPublisher } from './migrations/13_0008_agent_version_publisher.ts';

/** The agents unit's migrations, in name order. */
export const agentsMigrations: readonly Migration[] = [
  { name: '03_0004_agent', up: agent },
  { name: '03_0005_agent_version', up: agentVersion },
  { name: '03_0006_agent_head', up: agentHead },
  { name: '03_0007_agent_create_key', up: agentCreateKey },
  { name: '07_0004_agent_create_key_snapshot', up: agentCreateKeySnapshot },
  { name: '13_0008_agent_version_publisher', up: agentVersionPublisher },
];
