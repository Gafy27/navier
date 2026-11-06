import { existsSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRunners } from '../../src/runner/index.ts';
import type { TurnRunner } from '../../src/runner/index.ts';
import type { StartConfig } from '../../src/runtime/index.ts';
import { defineConformance } from './harness.ts';
import type { Leg, LegContext } from './harness.ts';

const DBOS_MODULE = new URL('../../src/runner/dbos/index.ts', import.meta.url);

/**
 * What the Phase 2 module must export for this leg. The name is this leg's
 * choice: the program fixes no export (see the ticket report).
 */
interface DbosModule {
  readonly launchDbosRunner: (ctx: LegContext) => Promise<{
    readonly runner: TurnRunner;
    readonly down: () => Promise<void>;
  }>;
}

/** The DBOS leg (D5): `DBOS.launch()` against the file's disposable Postgres. */
function dbosLeg(load: () => Promise<DbosModule>): Leg {
  return {
    name: 'dbos',
    up: async (ctx) => {
      const { launchDbosRunner } = await load();
      const launched = await launchDbosRunner(ctx);
      const config = { ...ctx.config, TEMPORAL_ADDRESS: '' } as StartConfig;
      return {
        runners: createRunners({
          dbos: launched.runner,
          startOn: () => 'dbos',
        }),
        config,
        down: launched.down,
      };
    },
  };
}

// The leg skips until Phase 2 lands the runner module; it never fails for its absence.
if (existsSync(fileURLToPath(DBOS_MODULE))) {
  defineConformance(
    dbosLeg(() => import(DBOS_MODULE.href) as Promise<DbosModule>),
    // eslint-disable-next-line no-restricted-syntax -- this file is the test entrypoint
    process.env['CONFORMANCE_ONLY']?.split(','),
  );
} else {
  void describe('conformance: dbos', () => {
    void test(
      'S1–S12 (skipped until Phase 2 lands src/runner/dbos)',
      {
        skip: 'src/runner/dbos is not landed',
      },
      () => undefined,
    );
  });
}
