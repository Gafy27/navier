import { parseOrgId } from '../db/index.ts';
import type { OrgId } from '../db/index.ts';
import type { Scope } from './scope.ts';
import { ScopeResource } from './scope.ts';

/** Object types authz-api knows. The scope resources, plus the P9.7 objects and the P13.5 conversation. */
export const AuthzObjectType = {
  ...ScopeResource,
  space: 'space',
  agent_version: 'agent_version',
  conversation: 'conversation',
} as const;

export type AuthzObjectType =
  (typeof AuthzObjectType)[keyof typeof AuthzObjectType];

export interface AuthzCheck {
  readonly object: { readonly type: AuthzObjectType; readonly id: string };
  readonly action: `can_${Scope['action']}`;
}

const encoder = new TextEncoder();
const keep = /[A-Za-z0-9._~/-]/u;

function encodeId(id: string): string {
  let out = '';
  for (const byte of encoder.encode(id)) {
    const ch = String.fromCharCode(byte);
    out +=
      byte < 0x80 && keep.test(ch)
        ? ch
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }
  return out;
}

/** The id segment authz-api expects for a type that has no id of its own. */
const ORG_SEGMENT = 'org';

/** One authz-api object. `id` omitted uses the org segment, same as a scope with no id. */
export function authzObject(
  org: OrgId,
  type: AuthzObjectType,
  id?: string,
): AuthzCheck['object'] {
  return {
    type,
    id: `${org}~${id === undefined ? ORG_SEGMENT : encodeId(id)}`,
  };
}

/** The authz-api id of one agent version: `<org>~<encoded agent id>~<n>`. */
export function agentVersionId(
  org: OrgId,
  agentId: string,
  version: number,
): string {
  return `${org}~${encodeId(agentId)}~${String(version)}`;
}

function decodeId(encoded: string): string | undefined {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

/**
 * Reads an authz-api version id back. It splits at the first and the last `~`.
 * The middle must be the canonical encoding of a non-empty agent id, so any
 * other shape, including another org's prefix or a leading-zero or zero version, is `undefined`.
 */
export function parseAgentVersionId(
  org: OrgId,
  id: string,
): { readonly agentId: string; readonly version: number } | undefined {
  const first = id.indexOf('~');
  const last = id.lastIndexOf('~');
  if (first === -1 || first === last) return undefined;
  if (id.slice(0, first) !== org) return undefined;
  const digits = id.slice(last + 1);
  if (!/^[1-9][0-9]*$/u.test(digits)) return undefined;
  const middle = id.slice(first + 1, last);
  const agentId = decodeId(middle);
  if (agentId === undefined || agentId === '') return undefined;
  if (encodeId(agentId) !== middle) return undefined;
  return { agentId, version: Number(digits) };
}

/** Maps a scope to one authz-api object and action inside one org. */
export function toAuthzCheck(org: OrgId, scope: Scope): AuthzCheck {
  return {
    object: authzObject(org, scope.resource, scope.id),
    action: `can_${scope.action}`,
  };
}

/**
 * Reads the catalog key from a grant object id (`<org>~<encoded key>`). Returns
 * `undefined` when the type is not `tool`, the id shape is wrong, or the org
 * segment is not a valid org id.
 */
export function toolKeyOf(object: {
  readonly type: string;
  readonly id: string;
}): string | undefined {
  if (object.type !== ScopeResource.tool) return undefined;
  const sep = object.id.indexOf('~');
  if (sep === -1) return undefined;
  if (object.id.indexOf('~', sep + 1) !== -1) return undefined;
  const orgSegment = object.id.slice(0, sep);
  if (!parseOrgId(orgSegment).ok) return undefined;
  const encoded = object.id.slice(sep + 1);
  if (encoded === '') return undefined;
  const key = decodeId(encoded);
  if (key === undefined || key === '') return undefined;
  if (encodeId(key) !== encoded) return undefined;
  return key;
}
