import { appError, err, ErrorCode, ok } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import type { OrgId } from '../../../db/index.ts';
import { hasToolKey } from '../../../catalog/index.ts';
import { parsePrincipalId, toolKeyOf } from '../../../identity/index.ts';
import type {
  Caller,
  ObjectGrantsInput,
  ObjectRef,
} from '../../../identity/index.ts';
import { DenyReason } from '../../../identity/index.ts';
import type { ApiDeps } from '../../adapter/app.ts';
import { apiNotFound, fromDecision } from '../../adapter/errors.ts';
import type { ApiFailure } from '../../adapter/errors.ts';
import { refOf, requireSameOrg } from './guard.ts';

/** One `checkObjects` item. Directory create passes these; other writes omit them. */
export type ManageCheck = {
  readonly object: ObjectRef;
  readonly action: string;
};

const USER_PREFIX = 'user:';
const TOOL_TYPE = 'tool';
const MANAGE_GRANTS = 'can_manage_grants';
const GROUP_MEMBER = /^group:([^:#~\s]{1,64})~([^:#~\s]+)#member$/u;
const ORG_MEMBER = /^organization:([^:#~\s]{1,64})#member$/u;

const INVALID_PRINCIPAL = appError(
  ErrorCode.invalid_argument,
  'invalid principal id: expected user:<ns>~<sub> or agent:<org>~<agentId>',
);
const LOOKUP_CAP = appError(
  ErrorCode.invalid_argument,
  'directory lookup cap exceeded',
);
const INVALID_TOOL = appError(ErrorCode.invalid_argument, 'invalid tool');
const INTERNAL = appError(ErrorCode.internal, 'internal error');

function namespaceOf(principal: string): string {
  const rest = principal.slice(USER_PREFIX.length);
  return rest.slice(0, rest.indexOf('~'));
}

function subjectOf(principal: string): string {
  return principal.slice(principal.indexOf('~') + 1);
}

/** D1: a person, an agent, or one of the two usersets. A wrong namespace is refused. */
function acceptGrantee(
  principal: string,
  namespace: string | undefined,
): Result<void, ApiFailure> {
  if (GROUP_MEMBER.test(principal) || ORG_MEMBER.test(principal)) {
    return ok(undefined);
  }
  const parsed = parsePrincipalId(principal);
  if (!parsed.ok) return parsed;
  if (
    principal.startsWith(USER_PREFIX) &&
    namespaceOf(principal) !== namespace
  ) {
    return err(INVALID_PRINCIPAL);
  }
  return ok(undefined);
}

function grantees(inputs: readonly ObjectGrantsInput[]): string[] {
  const names: string[] = [];
  for (const input of inputs) {
    for (const entry of [...(input.writes ?? []), ...(input.deletes ?? [])]) {
      names.push(entry.principal);
    }
  }
  return names;
}

/** Step 3 default: one `can_manage_grants` per distinct object, first-seen order. */
function defaultManage(
  inputs: readonly ObjectGrantsInput[],
): readonly ManageCheck[] {
  const items: ManageCheck[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const ref = refOf(input.object);
    if (seen.has(ref)) continue;
    seen.add(ref);
    items.push({ object: input.object, action: MANAGE_GRANTS });
  }
  return items;
}

/** Suffix skip only. A claim-only service subject is not on the grantee string. */
function lookupSubjects(
  inputs: readonly ObjectGrantsInput[],
  suffix: string | undefined,
): string[] {
  const subjects: string[] = [];
  const seen = new Set<string>();
  const skipSuffix = suffix !== undefined && suffix.length > 0;
  for (const input of inputs) {
    for (const entry of input.writes ?? []) {
      if (!entry.principal.startsWith(USER_PREFIX)) continue;
      const subject = subjectOf(entry.principal);
      if (skipSuffix && subject.endsWith(suffix)) continue;
      if (seen.has(subject)) continue;
      seen.add(subject);
      subjects.push(subject);
    }
  }
  return subjects;
}

/** Checks, then one `WriteGrants`. The first failure is the result. No tuple is written before that. */
export async function submitGrants(
  deps: ApiDeps,
  caller: Caller,
  org: OrgId,
  inputs: readonly ObjectGrantsInput[],
  manageChecks?: readonly ManageCheck[],
): Promise<Result<void, ApiFailure>> {
  const namespace = deps.principalNamespace;
  for (const principal of grantees(inputs)) {
    const accepted = acceptGrantee(principal, namespace);
    if (!accepted.ok) return accepted;
  }

  const same = requireSameOrg(org, [
    ...inputs.map((input) => refOf(input.object)),
    ...grantees(inputs),
  ]);
  if (!same.ok) return same;

  const items = manageChecks ?? defaultManage(inputs);
  const decided = await deps.authzAdmin.checkObjects(caller, org, items);
  if (!decided.ok) return decided;
  for (let index = 0; index < items.length; index += 1) {
    const decision = decided.value[index];
    if (decision === undefined || !decision.allow) {
      return err(
        fromDecision(
          decision?.allow === false
            ? decision
            : { allow: false, reason: DenyReason.unavailable },
        ),
      );
    }
  }

  const subjects = lookupSubjects(inputs, deps.serviceSubjectSuffix);
  if (subjects.length > 0) {
    const cap = deps.config.IDP_DIRECTORY_LOOKUP_MAX;
    if (cap === undefined) return err(INTERNAL);
    if (subjects.length > cap) return err(LOOKUP_CAP);
    const directory = deps.idpDirectory;
    if (directory === undefined) return err(INTERNAL);
    for (const subject of subjects) {
      const found = await directory.userExists(subject);
      if (!found.ok) return found;
    }
  }

  for (const input of inputs) {
    const writes = input.writes;
    if (
      input.object.type !== TOOL_TYPE ||
      writes === undefined ||
      writes.length === 0
    ) {
      continue;
    }
    const key = toolKeyOf(input.object);
    if (key === undefined) return err(INVALID_TOOL);
    if (!(await hasToolKey(deps.db, org, key))) return err(apiNotFound);
  }

  return deps.authzAdmin.writeGrants(caller, org, inputs);
}
