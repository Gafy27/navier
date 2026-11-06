import { ok } from '../../../index.ts';
import {
  createTool as create,
  drainTool as drain,
  emptyCatalogConfig,
  enableTool,
  listVisibleTools,
  moveToolSpaces,
  readToolServing,
  retireTool as retire,
} from '../../../catalog/index.ts';
import { listPinnedImplementations } from '../../../runtime/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { bind, emptyOk, orgScoped } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import {
  createTool,
  drainTool,
  getTool,
  listTools,
  retireTool,
  setToolEnabled,
  setToolSpaces,
} from './routes.ts';

export function tools(deps: ApiDeps): BoundRoute[] {
  const catalogDeps = () => ({
    db: deps.db,
    authz: deps.authz,
    config: emptyCatalogConfig,
  });
  return [
    bind(
      listTools,
      orgScoped(async (caller, org, { query }) => {
        const listed = await listVisibleTools(
          deps.db,
          deps.authzAdmin,
          caller,
          org,
          query.limit,
        );
        return listed.ok ? ok({ items: [...listed.value] }) : listed;
      }),
    ),
    bind(
      createTool,
      orgScoped((caller, org, { body }) =>
        create(catalogDeps(), caller, org, body),
      ),
    ),
    bind(
      getTool,
      orgScoped(async (_caller, org, { params, query }) => {
        const read = await readToolServing(
          deps.db,
          org,
          params.tool,
          query.implementationVersion,
        );
        return read.ok
          ? ok({ ...read.value.entry, serving: read.value.serving })
          : read;
      }),
    ),
    bind(
      setToolEnabled,
      orgScoped((caller, org, { params, body }) =>
        enableTool(
          deps.authz,
          deps.db,
          caller,
          org,
          params.tool,
          body.implementationVersion,
          body.enabled,
        ),
      ),
    ),
    bind(
      drainTool,
      orgScoped(async (caller, org, { params, body }) =>
        emptyOk(
          await drain(
            deps.authz,
            deps.db,
            caller,
            org,
            params.tool,
            body.implementationVersion,
          ),
        ),
      ),
    ),
    bind(
      retireTool,
      orgScoped(async (caller, org, { params, body }) =>
        emptyOk(
          await retire(
            {
              authz: deps.authz,
              db: deps.db,
              listPinned: listPinnedImplementations,
            },
            caller,
            org,
            params.tool,
            body.implementationVersion,
          ),
        ),
      ),
    ),
    bind(
      setToolSpaces,
      orgScoped(async (caller, org, { params, body }) =>
        emptyOk(
          await moveToolSpaces(deps.authz, caller, org, params.tool, body),
        ),
      ),
    ),
  ];
}
