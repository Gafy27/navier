export {
  agentPrincipalId,
  parsePrincipalId,
  PrincipalKind,
} from './principal.ts';
export type { Principal, PrincipalId } from './principal.ts';
export {
  AgentAction,
  AgentCreateAction,
  ToolCreateAction,
  formatScope,
  FsAction,
  ModelAction,
  parseScope,
  SandboxAction,
  SCOPE_GRAMMAR,
  ScopeResource,
  ToolAction,
} from './scope.ts';
export type { Scope } from './scope.ts';
export { AuthzObjectType, authzObject, toolKeyOf } from './scope-map.ts';
export { createCredential } from './credential.ts';
export type { Credential } from './credential.ts';
export { DenyReason } from './decision.ts';
export type { Decision } from './decision.ts';
export { createAgentPrincipal, getAgentPrincipal } from './agent-principal.ts';
export type { AgentPrincipal } from './agent-principal.ts';
export { IDENTITY_AUDIT } from './audit-kinds.ts';
export { identityMigrations } from './migrations.ts';
export { listScopeRequests, requestGrant } from './request.ts';
export type { ScopeRequest } from './request.ts';
export { CallerConfigSchema } from './caller-config.ts';
export type { CallerConfig } from './caller-config.ts';
export { callerProbe, createCallerVerifier } from './caller.ts';
export type { Caller, CallerVerifier } from './caller.ts';
export { AuthzConfigSchema } from './authz-config.ts';
export type { AuthzConfig } from './authz-config.ts';
export { authzProbe, createAuthz } from './authz.ts';
export type { Authz, AgentUse, AgentUseQuery } from './authz.ts';
export {
  createClientCredentialsToken,
  createServiceToken,
} from './service-token.ts';
export type { ClientCredentialsConfig } from './service-token.ts';
export { createAuthzAdmin } from './authz-admin.ts';
export type {
  AuditEventView,
  AuthzAdmin,
  GrantEntry,
  ObjectGrantsInput,
  ObjectRef,
  RoleEntry,
} from './authz-admin.ts';
