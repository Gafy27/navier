import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';

declare const principalIdBrand: unique symbol;

/** A principal id. It comes only from `parsePrincipalId` or `agentPrincipalId`. */
export type PrincipalId = string & { readonly [principalIdBrand]: true };

/** The closed set of principal kinds. */
export const PrincipalKind = {
  person: 'person',
  service: 'service',
  agent: 'agent',
} as const;

export type PrincipalKind = (typeof PrincipalKind)[keyof typeof PrincipalKind];

/** `org` is set for an agent and absent for a person or service. */
export interface Principal {
  readonly kind: PrincipalKind;
  readonly id: PrincipalId;
  readonly org?: OrgId;
}

const userPattern = /^user:[a-z0-9-]+~[^:#\s]+$/u;
const subjectBan = /[:#]|\s/u;

function brand(raw: string): PrincipalId {
  return raw as PrincipalId;
}

function invalid(): Result<never> {
  return err(
    appError(
      ErrorCode.invalid_argument,
      'invalid principal id: expected user:<ns>~<sub> or agent:<org>~<agentId>',
    ),
  );
}

/** Parses `user:<ns>~<sub>` or `agent:<org>~<agentId>`. The error never echoes the input. */
export function parsePrincipalId(raw: unknown): Result<PrincipalId> {
  if (typeof raw !== 'string') return invalid();
  if (userPattern.test(raw)) return ok(brand(raw));
  if (raw.startsWith('agent:')) {
    const rest = raw.slice('agent:'.length);
    const sep = rest.indexOf('~');
    if (sep !== -1) {
      const org = parseOrgId(rest.slice(0, sep));
      const agentId = rest.slice(sep + 1);
      if (org.ok && agentId !== '' && !subjectBan.test(agentId)) {
        return ok(brand(raw));
      }
    }
  }
  return invalid();
}

/** The only way to build an agent principal id. `agentId` obeys the `sub` ban. */
export function agentPrincipalId(
  org: OrgId,
  agentId: string,
): Result<PrincipalId> {
  if (agentId === '' || subjectBan.test(agentId)) return invalid();
  return ok(brand(`agent:${org}~${agentId}`));
}
