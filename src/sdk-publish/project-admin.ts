import { ErrorCode } from '../index.ts';
import {
  deriveAgentId,
  publishVersion,
  readAgent,
  setPublished,
} from '../agents/index.ts';
import { moveToolSpaces } from '../catalog/index.ts';
import { parsePrincipalId, SCOPE_GRAMMAR } from '../identity/index.ts';
import type { PrincipalId } from '../identity/index.ts';
import { fail, unwrap, withSession } from './publish.ts';
import type { PublishOptions } from './publish.ts';

export type Visibility = 'published' | 'unpublished';

/** A project id is an agent-grammar id: no `:`, `#`, or whitespace. */
export function parseProjectId(raw: string): string {
  if (!SCOPE_GRAMMAR.agent.validId(raw)) {
    fail(ErrorCode.invalid_argument, 'project: invalid');
  }
  return raw;
}

/** A person is a `user:` principal. An agent or service id is refused. */
export function parsePerson(raw: string): PrincipalId {
  const parsed = parsePrincipalId(raw);
  if (!parsed.ok || !parsed.value.startsWith('user:')) {
    fail(ErrorCode.invalid_argument, 'person: invalid');
  }
  return parsed.value;
}

/** A tool key follows the tool grammar. */
export function parseToolKey(raw: string): string {
  if (!SCOPE_GRAMMAR.tool.validId(raw)) {
    fail(ErrorCode.invalid_argument, 'tool: invalid');
  }
  return raw;
}

/** D3: `project create`. Two calls, the editor first, because the first write creates the project. */
export async function createProject(
  project: string,
  options: PublishOptions,
): Promise<{ project: string; roles: ['editor', 'member'] }> {
  const id = parseProjectId(project);
  return withSession(options, async ({ authz, caller, org }) => {
    const me = caller.principal.id;
    unwrap(
      await authz.writeSpaceRoles(caller, org, id, [
        { principal: me, role: 'editor' },
      ]),
    );
    unwrap(
      await authz.writeSpaceRoles(caller, org, id, [
        { principal: me, role: 'member' },
      ]),
    );
    return { project: id, roles: ['editor', 'member'] };
  });
}

/** D3: `project add-member`. Writes `member` for one user. */
export async function addProjectMember(
  project: string,
  person: string,
  options: PublishOptions,
): Promise<{ project: string; member: string }> {
  const id = parseProjectId(project);
  const member = parsePerson(person);
  return withSession(options, async ({ authz, caller, org }) => {
    unwrap(
      await authz.writeSpaceRoles(caller, org, id, [
        { principal: member, role: 'member' },
      ]),
    );
    return { project: id, member };
  });
}

/** D3: `project place-tool`. Adds the project to the tool's sealed project list. */
export async function placeTool(
  project: string,
  toolKey: string,
  options: PublishOptions,
): Promise<{ project: string; tool: string }> {
  const id = parseProjectId(project);
  const key = parseToolKey(toolKey);
  return withSession(options, async ({ authz, caller, org }) => {
    unwrap(
      await moveToolSpaces(authz, caller, org, key, { add: [id], remove: [] }),
    );
    return { project: id, tool: key };
  });
}

/** D3: `release`. Seals the agent's active version, one pin per tool, each to `project`. */
export async function releaseAgent(
  agent: string,
  project: string,
  options: PublishOptions,
): Promise<{
  agent: string;
  agentId: string;
  version: number;
  project: string;
  tools: string[];
}> {
  const id = parseProjectId(project);
  return withSession(options, async ({ db, authz, caller, org }) => {
    const agentId = deriveAgentId(org, agent);
    const deps = { db, authz };
    const current = unwrap(await readAgent(deps, caller, org, agentId));
    const version = current.version.number;
    const { pins } = unwrap(
      await publishVersion(deps, caller, org, agentId, version, { space: id }),
    );
    const tools = pins.map((pin) => pin.toolKey);
    return { agent, agentId, version, project: id, tools };
  });
}

/** D3: `visibility`. Sets the agent published to the organization or not. */
export async function setVisibility(
  agent: string,
  visibility: Visibility,
  options: PublishOptions,
): Promise<{ agent: string; published: boolean }> {
  return withSession(options, async ({ db, authz, caller, org }) => {
    const published = visibility === 'published';
    unwrap(
      await setPublished(
        { db, authz },
        caller,
        org,
        deriveAgentId(org, agent),
        published,
      ),
    );
    return { agent, published };
  });
}
