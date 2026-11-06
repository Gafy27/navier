/** Audit kinds this unit writes. */
export const CATALOG_AUDIT = {
  toolRegistered: 'catalog.tool_registered',
  toolEnabled: 'catalog.tool_enabled',
  toolDisabled: 'catalog.tool_disabled',
  toolDraining: 'catalog.tool_draining',
  toolRetired: 'catalog.tool_retired',
} as const;
