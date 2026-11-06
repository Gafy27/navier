import { err, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import type { OrgId } from '../../db/index.ts';
import type { Authz, AuthzAdmin, Caller } from '../../identity/index.ts';
import { apiInternal, fromDecision } from './errors.ts';
import type { ApiFailure } from './errors.ts';
import { CheckKind } from './route-types.ts';
import type { Check } from './route-types.ts';
import { AUTHZ_OBJECT_ID_SEP } from './scope-names.ts';

/** Step 5 of the pipeline (D2): reads only the caller and the path parameters. */
export async function runCheck(
  check: Check,
  caller: Caller,
  org: OrgId | undefined,
  params: Readonly<Record<string, string>>,
  authz: Authz,
  authzAdmin: AuthzAdmin,
): Promise<Result<void, ApiFailure>> {
  switch (check.kind) {
    case CheckKind.enum.caller:
    case CheckKind.enum.store:
      return ok(undefined);
    case CheckKind.enum.scope: {
      const id = check.idParam === undefined ? check.id : params[check.idParam];
      if (org === undefined || (check.idParam !== undefined && !id)) {
        return err(apiInternal);
      }
      const head = `${check.resource}:${check.action}`;
      const scope = id === undefined ? head : `${head}:${id}`;
      const decided = await authz.check(org, caller, scope);
      if (!decided.ok) return decided;
      return decided.value.allow
        ? ok(undefined)
        : err(fromDecision(decided.value));
    }
    case CheckKind.enum.object: {
      // P13.1: `<type>:<idParams joined by '~'>`, org first; `organization:<org>` has one param.
      const parts = check.idParams.map((name) => params[name]);
      if (org === undefined || parts.some((part) => !part)) {
        return err(apiInternal);
      }
      const object = {
        type: check.type,
        id: parts.join(AUTHZ_OBJECT_ID_SEP),
      };
      const decided = await authzAdmin.checkObjects(caller, org, [
        { object, action: check.action },
      ]);
      if (!decided.ok) return decided;
      const [decision] = decided.value;
      if (decision === undefined) return err(apiInternal);
      return decision.allow ? ok(undefined) : err(fromDecision(decision));
    }
  }
}
