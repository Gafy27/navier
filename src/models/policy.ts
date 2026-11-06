import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import {
  appendIfNewest,
  withTables,
  withTransaction,
  writeAudit,
} from '../db/index.ts';
import type { Db, OrgId } from '../db/index.ts';
import type { Authz, Caller } from '../identity/index.ts';
import { MODELS_AUDIT } from './audit-kinds.ts';
import { parseModelPolicy, readModelPolicy } from './schema.ts';
import type { ModelPolicy, ModelRef } from './schema.ts';
import { modelsView } from './tables.ts';
import type { ModelsTables } from './tables.ts';

const ADMIN_SCOPE = 'model:admin';

/** The newest policy row of each ref, keyed by `policyKey`. A ref with no row is absent. */
export async function newestPolicies(
  db: Db,
  org: OrgId,
  refs: readonly ModelRef[],
): Promise<Map<string, ModelPolicy>> {
  const found = new Map<string, ModelPolicy>();
  if (refs.length === 0) return found;
  const rows = await modelsView(db)
    .selectFrom('model_policy')
    .distinctOn(['provider', 'model'])
    .select(['provider', 'model', 'enabled', 'degraded'])
    .where('org_id', '=', org)
    .where((eb) =>
      eb.or(refs.map((r) => eb.and({ provider: r.provider, model: r.model }))),
    )
    .orderBy('provider')
    .orderBy('model')
    .orderBy('seq', 'desc')
    .execute();
  for (const row of rows) {
    const policy = readModelPolicy(row);
    found.set(policyKey(policy), policy);
  }
  return found;
}

/** The newest policy row of every model in `org`, by provider then model. */
export async function listModelPolicies(
  db: Db,
  org: OrgId,
): Promise<readonly ModelPolicy[]> {
  const rows = await modelsView(db)
    .selectFrom('model_policy')
    .distinctOn(['provider', 'model'])
    .select(['provider', 'model', 'enabled', 'degraded'])
    .where('org_id', '=', org)
    .orderBy('provider')
    .orderBy('model')
    .orderBy('seq', 'desc')
    .execute();
  return rows.map(readModelPolicy);
}

export function policyKey(ref: ModelRef): string {
  return JSON.stringify([ref.provider, ref.model]);
}

/** Appends a policy row after `model:admin` is allowed. Any other decision refuses. */
export async function setModelPolicy(
  authz: Authz,
  db: Db,
  caller: Caller,
  org: OrgId,
  policy: unknown,
): Promise<Result<ModelPolicy>> {
  const decision = await authz.check(org, caller, ADMIN_SCOPE);
  if (!decision.ok) return decision;
  if (!decision.value.allow) {
    return err(appError(ErrorCode.permission_denied, `missing ${ADMIN_SCOPE}`));
  }
  const parsed = parseModelPolicy(policy);
  if (!parsed.ok) return parsed;
  const accepted = parsed.value;
  return withTransaction(db, async (tx) => {
    const appended = await appendIfNewest<ModelsTables, 'model_policy'>(
      withTables<ModelsTables>(tx),
      {
        table: 'model_policy',
        org,
        key: { provider: accepted.provider, model: accepted.model },
        accept: () => true,
        row: () => ({
          provider: accepted.provider,
          model: accepted.model,
          enabled: accepted.enabled,
          degraded: accepted.degraded,
          by: caller.principal.id,
        }),
      },
    );
    if (!appended.ok) return appended;
    const audited = await writeAudit(tx, org, {
      kind: MODELS_AUDIT.policySet,
      actor: { kind: caller.principal.kind, id: caller.principal.id },
      target: { kind: 'model', id: `${accepted.provider}/${accepted.model}` },
    });
    if (!audited.ok) return audited;
    return ok(accepted);
  });
}

/**
 * Save-time names: the version model must be listed and enabled; each fallback
 * must be listed. Degraded and disabled fallbacks pass.
 */
export async function checkSavedModels(
  db: Db,
  org: OrgId,
  version: {
    readonly model: ModelRef;
    readonly fallbacks: readonly ModelRef[];
  },
): Promise<Result<void>> {
  const policies = await newestPolicies(db, org, [
    version.model,
    ...version.fallbacks,
  ]);
  const head = policies.get(policyKey(version.model));
  if (head === undefined || !head.enabled) {
    const reason = head === undefined ? 'missing' : 'disabled';
    return err(appError(ErrorCode.invalid_argument, `model: ${reason}`));
  }
  const index = version.fallbacks.findIndex((f) => !policies.has(policyKey(f)));
  if (index !== -1) {
    return err(
      appError(
        ErrorCode.invalid_argument,
        `fallbacks.${String(index)}: missing`,
      ),
    );
  }
  return ok(undefined);
}
