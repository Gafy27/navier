import { fileURLToPath } from 'node:url';
import { runnersForTemporal } from '../../src/runner/index.ts';
import {
  connectTemporal,
  startWorker,
} from '../../src/runner/temporal/index.ts';
import { runtimeActivities } from '../../src/runner/temporal/activities.ts';
import { reaperActivities } from '../../src/runner/temporal/reaper.ts';
import {
  messageStatusReader,
  streamSweepActivities,
} from '../../src/runtime/index.ts';
import type { StartConfig } from '../../src/runtime/index.ts';
import { defineConformance, startTemporalServer } from './harness.ts';
import type { Leg } from './harness.ts';

const WORKFLOWS = fileURLToPath(
  new URL('../../src/workflows.ts', import.meta.url),
);

/** The Temporal leg (D5): a local dev server, one worker, the frozen adapter. */
const temporal: Leg = {
  name: 'temporal',
  up: async (ctx) => {
    const server = await startTemporalServer();
    const config: StartConfig = {
      ...ctx.config,
      TEMPORAL_ADDRESS: server.address,
    };
    const handle = await connectTemporal(config, ctx.log);
    if (!handle.ok) throw new Error('temporal is unreachable');
    const runners = runnersForTemporal(handle.value, {
      config,
      readStatus: messageStatusReader(ctx.db),
    });
    const reaper = reaperActivities({
      db: ctx.db,
      temporal: handle.value,
      config,
      log: ctx.log,
    });
    const worker = await startWorker(config, ctx.log, WORKFLOWS, {
      ...runtimeActivities({
        db: ctx.db,
        authz: ctx.authz,
        model: ctx.model,
        tools: ctx.tools,
        runners,
        config,
        log: ctx.log,
      }),
      ...reaper,
      ...streamSweepActivities({ db: ctx.db, config }),
    });
    if (!worker.ok) throw new Error('temporal worker did not start');
    return {
      runners,
      config,
      // Pause expiry is the reaper's sweep on Temporal; one pass per poll stands in for its schedule.
      nudge: () =>
        reaper.sweep({ storeCallTimeoutMs: config.STORE_CALL_TIMEOUT_MS }),
      down: async () => {
        await worker.value.shutdown();
        await handle.value.close();
        await server.stop();
      },
    };
  },
};

// eslint-disable-next-line no-restricted-syntax -- this file is the test entrypoint
const only = process.env['CONFORMANCE_ONLY']?.split(',');
defineConformance(temporal, only);
