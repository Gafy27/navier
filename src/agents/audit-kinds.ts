/** Audit kinds this unit writes. Owner registration is audited by authz-api. */
export const AGENTS_AUDIT = {
  created: 'agents.created',
  versionSaved: 'agents.version_saved',
  archived: 'agents.archived',
  restored: 'agents.restored',
} as const;
