import type { Db, OrgId } from '../db/index.ts';
import { newestPolicies, policyKey } from './policy.ts';
import type { ModelChoice, ModelPolicy } from './schema.ts';

export const ResolutionMethod = {
  selection: 'selection',
  version: 'version',
  fallback: 'fallback',
} as const;
export type ResolutionMethod =
  (typeof ResolutionMethod)[keyof typeof ResolutionMethod];

export type ModelResolution =
  | {
      readonly kind: 'resolved';
      readonly choice: ModelChoice;
      readonly method: ResolutionMethod;
    }
  | { readonly kind: 'none_enabled' };

/** The pure order: selection, version model, then each fallback. The first enabled and not degraded wins. */
export function walkModels(
  selection: ModelChoice | undefined,
  version: {
    readonly model: ModelChoice;
    readonly fallbacks: readonly ModelChoice[];
  },
  policies: ReadonlyMap<string, ModelPolicy>,
): ModelResolution {
  const candidates = [
    ...(selection === undefined
      ? []
      : [{ choice: selection, method: ResolutionMethod.selection }]),
    { choice: version.model, method: ResolutionMethod.version },
    ...version.fallbacks.map((choice) => ({
      choice,
      method: ResolutionMethod.fallback,
    })),
  ];
  for (const { choice, method } of candidates) {
    const policy = policies.get(policyKey(choice));
    if (policy?.enabled === true && !policy.degraded) {
      return { kind: 'resolved', choice, method };
    }
  }
  return { kind: 'none_enabled' };
}

export const RecheckKind = {
  kept: 'kept',
  fallback: 'fallback',
  none_enabled: 'none_enabled',
} as const;

export type ResolutionRecheck =
  | { readonly kind: typeof RecheckKind.kept }
  | { readonly kind: typeof RecheckKind.fallback; readonly choice: ModelChoice }
  | { readonly kind: typeof RecheckKind.none_enabled };

/** The resume rule: an enabled stored model is kept, degraded or not. Else the first enabled fallback, degraded or not. */
export function recheckResolution(
  policies: ReadonlyMap<string, ModelPolicy>,
  stored: ModelChoice,
  fallbacks: readonly ModelChoice[],
): ResolutionRecheck {
  const isEnabled = (choice: ModelChoice) =>
    policies.get(policyKey(choice))?.enabled === true;
  if (isEnabled(stored)) return { kind: RecheckKind.kept };
  const choice = fallbacks.find(isEnabled);
  return choice === undefined
    ? { kind: RecheckKind.none_enabled }
    : { kind: RecheckKind.fallback, choice };
}

/** Loads the newest policy rows once, then walks. `none_enabled` is a value, not an error. */
export async function resolveModel(
  db: Db,
  org: OrgId,
  selection: ModelChoice | undefined,
  version: {
    readonly model: ModelChoice;
    readonly fallbacks: readonly ModelChoice[];
  },
): Promise<ModelResolution> {
  const refs = [
    ...(selection === undefined ? [] : [selection]),
    version.model,
    ...version.fallbacks,
  ];
  return walkModels(selection, version, await newestPolicies(db, org, refs));
}
