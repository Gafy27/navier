import { ok } from '../../../index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { openApiDocument } from '../../adapter/openapi.ts';
import { bind } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import { catalog } from '../../catalog.ts';
import { getOpenApi } from './routes.ts';

export function platform(deps: ApiDeps): BoundRoute[] {
  return [
    bind(getOpenApi, () => {
      deps.log.debug({ route: getOpenApi.operationId }, 'openapi built');
      return Promise.resolve(ok(openApiDocument(catalog)));
    }),
  ];
}
