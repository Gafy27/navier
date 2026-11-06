import { z } from '../index.ts';

/** The catalog ceilings moved to the org snapshot. */
export const CatalogConfigSchema = z.object({});

/** Callers still pass their config object. It no longer carries a ceiling. */
export type CatalogConfig = object;

export const emptyCatalogConfig: CatalogConfig = {};
