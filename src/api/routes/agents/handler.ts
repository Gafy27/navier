import {
  archiveAgent as archive,
  listAgents as list,
  listVersions,
  publishVersion,
  readAgent,
  restoreAgent as restore,
  saveAgent,
  setPublished,
} from '../../../agents/index.ts';
import type { AgentRecord } from '../../../agents/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { bind, emptyOk, mapOk, orgScoped } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import {
  archiveAgent,
  createAgent,
  getAgent,
  getAgentVersion,
  listAgents,
  listAgentVersions,
  publishAgentVersion,
  restoreAgent,
  setAgentPublished,
  updateAgent,
} from './routes.ts';

/** The agent store does not export its read shape; this is `readAgent`'s value. */
type AgentRead = Extract<
  Awaited<ReturnType<typeof readAgent>>,
  { readonly ok: true }
>['value'];
type VersionRecord = AgentRead['version'];

const recordWire = (r: AgentRecord) => ({
  id: r.id,
  principal: r.principal,
  status: r.status,
  activeVersion: r.activeVersion,
  createdBy: r.createdBy,
  createdAt: r.createdAt.toISOString(),
});

const versionWire = (v: VersionRecord) => ({
  number: v.number,
  definition: v.definition,
  hash: v.hash,
  authorId: v.authorId,
  createdAt: v.createdAt.toISOString(),
});

const readWire = (read: AgentRead) => ({
  record: recordWire(read.record),
  version: versionWire(read.version),
});

export function agents(deps: ApiDeps): BoundRoute[] {
  const store = () => ({ db: deps.db, authz: deps.authz });
  const saveDeps = () => ({ ...store(), config: deps.agentsConfig });
  return [
    bind(
      listAgents,
      orgScoped(async (caller, org, { query }) =>
        mapOk(
          await list(store(), caller, org, {
            view: query.view,
            limit: query.limit,
            ...(query.cursor === undefined ? {} : { after: query.cursor }),
          }),
          (page) => ({
            items: page.items.map(recordWire),
            ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
          }),
        ),
      ),
    ),
    bind(
      createAgent,
      orgScoped((caller, org, { body }) =>
        saveAgent(saveDeps(), caller, org, {
          idempotencyKey: body.idempotencyKey,
          document: body.document,
        }),
      ),
    ),
    bind(
      getAgent,
      orgScoped(async (caller, org, { params, query }) =>
        mapOk(
          await readAgent(store(), caller, org, params.agent, query.version),
          readWire,
        ),
      ),
    ),
    bind(
      updateAgent,
      orgScoped((caller, org, { params, body }) =>
        saveAgent(saveDeps(), caller, org, {
          id: params.agent,
          document: body.document,
        }),
      ),
    ),
    bind(
      listAgentVersions,
      orgScoped(async (caller, org, { params, query }) =>
        mapOk(
          await listVersions(
            store(),
            caller,
            org,
            params.agent,
            query.limit,
            query.before,
          ),
          (items) => ({ items: items.map(versionWire) }),
        ),
      ),
    ),
    bind(
      getAgentVersion,
      orgScoped(async (caller, org, { params }) =>
        mapOk(
          await readAgent(store(), caller, org, params.agent, params.version),
          readWire,
        ),
      ),
    ),
    bind(
      archiveAgent,
      orgScoped(async (caller, org, { params }) =>
        mapOk(await archive(store(), caller, org, params.agent), recordWire),
      ),
    ),
    bind(
      restoreAgent,
      orgScoped(async (caller, org, { params }) =>
        mapOk(await restore(store(), caller, org, params.agent), recordWire),
      ),
    ),
    bind(
      publishAgentVersion,
      orgScoped((caller, org, { params, body }) =>
        publishVersion(store(), caller, org, params.agent, params.version, {
          space: body.space,
          ...(body.tools === undefined ? {} : { tools: body.tools }),
        }),
      ),
    ),
    bind(
      setAgentPublished,
      orgScoped(async (caller, org, { params, body }) =>
        emptyOk(
          await setPublished(
            store(),
            caller,
            org,
            params.agent,
            body.published,
          ),
        ),
      ),
    ),
  ];
}
