import { z } from '../../index.ts';

/**
 * A copy of the scope resources and their actions in `src/identity/scope.ts`, so
 * route declarations and the client never import `identity`. `test/contract/api.test.ts` pins it.
 */
export const ScopeResource = z.enum({
  agent: 'agent',
  tool: 'tool',
  fs: 'fs',
  sandbox: 'sandbox',
  model: 'model',
  agent_create: 'agent_create',
  tool_create: 'tool_create',
  org: 'org',
});
export type ScopeResource = z.infer<typeof ScopeResource>;

/** Each resource's actions. */
export const SCOPE_ACTIONS = {
  agent: z.enum({ write: 'write', admin: 'admin' }),
  tool: z.enum({
    invoke: 'invoke',
    assign: 'assign',
    enable: 'enable',
    register: 'register',
  }),
  fs: z.enum({ read: 'read', write: 'write' }),
  sandbox: z.enum({ exec: 'exec' }),
  model: z.enum({ admin: 'admin' }),
  agent_create: z.enum({ create: 'create' }),
  tool_create: z.enum({ create: 'create' }),
  org: z.enum({ config: 'config' }),
} as const satisfies Record<ScopeResource, z.ZodEnum>;

export type ScopeActionOf = {
  [R in ScopeResource]: z.infer<(typeof SCOPE_ACTIONS)[R]>;
};

/** Object types the authz directory and routes name. Kept here so `routes.ts` stays pure. */
export const AuthzDirectoryType = z.enum({
  organization: 'organization',
  space: 'space',
  group: 'group',
  marking_category: 'marking_category',
  marking: 'marking',
});
export type AuthzDirectoryType = z.infer<typeof AuthzDirectoryType>;

/** The authz-api action an `object` check asks for on a read route. */
export const ObjectAction = z.enum({ can_see: 'can_see' });
export type ObjectAction = z.infer<typeof ObjectAction>;

/** Joins org and id segments in an authz-api object id, as in `A~s1`. */
export const AUTHZ_OBJECT_ID_SEP = '~';
