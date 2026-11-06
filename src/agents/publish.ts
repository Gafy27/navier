import { appError, err, ErrorCode, ok } from '../index.ts';
import type { AppError, Result } from '../index.ts';
import { withTransaction } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import { DenyReason } from '../identity/index.ts';
import type { Caller, Decision, Scope } from '../identity/index.ts';
import { parseStoredDefinition } from './document.ts';
import { recordPublisher } from './publisher.ts';
import { mayRead, readAgent } from './store.ts';
import type { StoreDeps } from './store.ts';

const assign = (toolKey: string): Scope => ({
  resource: 'tool',
  action: 'assign',
  id: toolKey,
});

/**
 * The first deny in `keys` order decides (PD3). A missing decision is not an
 * answer: it fails closed as unavailable. Mapping follows `fromDecision`
 * (D7 §2): not visible is not found with no key; no grant names the key.
 */
function assignDenial(
  decisions: readonly (Decision | undefined)[],
  keys: readonly string[],
): AppError | undefined {
  for (const [i, toolKey] of keys.entries()) {
    const decision = decisions[i];
    if (decision === undefined) {
      return appError(ErrorCode.unavailable, 'authorization unavailable');
    }
    if (decision.allow) continue;
    switch (decision.reason) {
      case DenyReason.not_visible:
        return appError(ErrorCode.not_found, 'not found');
      case DenyReason.no_grant:
        return appError(
          ErrorCode.permission_denied,
          `tool ${toolKey}: missing assign`,
        );
      case DenyReason.unavailable:
        return appError(ErrorCode.unavailable, 'authorization unavailable');
      default:
        return appError(ErrorCode.internal, 'internal error');
    }
  }
  return undefined;
}

export interface PublishBody {
  readonly space: string;
  readonly tools?: readonly string[];
}

export interface ToolPin {
  readonly toolKey: string;
  readonly space: string;
}

/**
 * Seals `version` with one pin per tool key of the version, each to `body.space` (D2).
 * A `body.tools` set other than the version's keys is refused before the RPC.
 * No scope check here: `PublishAgentVersion` decides.
 */
export async function publishVersion(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
  version: number,
  body: PublishBody,
): Promise<Result<{ readonly pins: readonly ToolPin[] }>> {
  const read = await readAgent(deps, caller, org, id, version);
  if (!read.ok) return read;
  const definition = parseStoredDefinition(read.value.version.definition);
  if (!definition.ok) {
    return err(appError(ErrorCode.internal, 'stored version is invalid'));
  }
  const keys = new Set(definition.value.tools.map((tool) => tool.key));
  if (body.tools !== undefined) {
    const named = new Set(body.tools);
    if (named.size !== keys.size || [...named].some((k) => !keys.has(k))) {
      return err(
        appError(
          ErrorCode.invalid_argument,
          'tools: differs from the version tools',
        ),
      );
    }
  }
  const sortedKeys = [...keys].sort();
  const decisions = await deps.authz.checkMany(
    org,
    caller,
    sortedKeys.map(assign),
  );
  if (!decisions.ok) return decisions;
  const denial = assignDenial(decisions.value, sortedKeys);
  if (denial !== undefined) return err(denial);
  const pins = [...keys].map((toolKey) => ({ toolKey, space: body.space }));
  const sealed = await deps.authz.publishAgentVersion(
    caller,
    org,
    id,
    version,
    pins,
  );
  if (!sealed.ok) return sealed;
  const recorded = await withTransaction(deps.db, async (tx) => {
    await recordPublisher(tx, org, id, version, caller.principal.id);
    return ok(undefined);
  });
  if (!recorded.ok) return recorded;
  return ok({ pins });
}

/** The open flag (`SetAgentPublished`). The RPC decides owner or `org_admin`. */
export async function setPublished(
  deps: StoreDeps,
  caller: Caller,
  org: OrgId,
  id: string,
  published: boolean,
): Promise<Result<void>> {
  const readable = await mayRead(deps, caller, org, id);
  if (!readable.ok) return readable;
  return deps.authz.setAgentPublished(caller, org, id, published);
}
