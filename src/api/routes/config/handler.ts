import { ok } from '../../../index.ts';
import {
  listModelPolicies,
  setModelPolicy as setPolicy,
} from '../../../models/index.ts';
import {
  listProviders as list,
  readOrgConfig,
  setOrgConfig,
  setProvider as set,
  setProviderKey as setKey,
} from '../../../orgconfig/index.ts';
import { verifyKey } from '../../../runtime/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { bind, orgScoped } from '../../adapter/route.ts';
import type { BoundRoute } from '../../adapter/route.ts';
import {
  getOrgConfig,
  listModels,
  listProviders,
  patchOrgConfig,
  setModelPolicy,
  setProvider,
  setProviderKey,
} from './routes.ts';

export function config(deps: ApiDeps): BoundRoute[] {
  return [
    bind(
      getOrgConfig,
      orgScoped(async (_caller, org) => {
        const read = await readOrgConfig(deps.db, org);
        return ok(
          read.set
            ? { set: true, seq: read.seq, snapshot: read.snapshot }
            : { set: false },
        );
      }),
    ),
    bind(
      patchOrgConfig,
      orgScoped((caller, org, { body }) =>
        setOrgConfig(deps.authz, deps.db, caller, org, body),
      ),
    ),
    bind(
      listProviders,
      orgScoped(async (_caller, org) =>
        ok({ items: await list(deps.db, org) }),
      ),
    ),
    bind(
      setProvider,
      orgScoped((caller, org, { params, body }) =>
        set(
          deps.authz,
          deps.db,
          caller,
          org,
          { provider: params.provider, ...body },
          deps.adapterNames,
        ),
      ),
    ),
    bind(
      setProviderKey,
      orgScoped((caller, org, { params, body, signal }) =>
        setKey(
          deps.authz,
          deps.db,
          caller,
          org,
          params.provider,
          body.key,
          verifyKey,
          AbortSignal.any([
            signal,
            AbortSignal.timeout(deps.config.PROVIDER_VERIFY_TIMEOUT_MS),
          ]),
        ),
      ),
    ),
    bind(
      listModels,
      orgScoped(async (_caller, org) =>
        ok({ items: [...(await listModelPolicies(deps.db, org))] }),
      ),
    ),
    bind(
      setModelPolicy,
      orgScoped((caller, org, { params, body }) =>
        setPolicy(deps.authz, deps.db, caller, org, {
          provider: params.provider,
          model: params.model,
          ...body,
        }),
      ),
    ),
  ];
}
