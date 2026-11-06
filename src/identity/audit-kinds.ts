/** Audit kinds this unit writes. Grant audit is authz-api's. */
export const IDENTITY_AUDIT = {
  agentPrincipalCreated: 'identity.agent_principal_created',
  scopeRequested: 'identity.scope_requested',
} as const;
