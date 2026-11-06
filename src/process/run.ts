import { appError, ErrorCode, err } from '../index.ts';
import type { CoreConfig, Logger, Result } from '../index.ts';
import type { ReadinessProbe } from '../db/index.ts';
import type { HealthConfig } from '../config.ts';
import { createHealthServer } from './health.ts';
import type { HealthTools } from './health.ts';

/** A thing the process opened: its name, how to close it, and how to ask if it is up. */
export interface Resource {
  readonly name: string;
  readonly close: () => Promise<void>;
  readonly probe?: ReadinessProbe;
}

/** Where signals come from. The default is the process; tests pass an emitter. */
export interface SignalSource {
  readonly on: (event: 'SIGTERM' | 'SIGINT', listener: () => void) => unknown;
  readonly off: (event: 'SIGTERM' | 'SIGINT', listener: () => void) => unknown;
}

export interface ProcessSpec {
  readonly kind: 'api' | 'worker';
  readonly config: Pick<CoreConfig, 'SHUTDOWN_TIMEOUT_MS'> & HealthConfig;
  readonly log: Logger;
  /** Calls `track` for each resource the moment it is open, in open order. */
  readonly open: (track: (resource: Resource) => void) => Promise<Result<void>>;
  readonly signals?: SignalSource;
  /** PD8: when set, the health server answers `GET /tools` to its bearer. */
  readonly tools?: HealthTools | undefined;
}

const SIGNALS = ['SIGTERM', 'SIGINT'] as const;

/**
 * Runs the health server, opens the resources, and waits for a signal. Then
 * closes in reverse open order within `SHUTDOWN_TIMEOUT_MS`. Resolves 0 on a
 * clean shutdown and 1 on any failure; never exits the process itself.
 */
export async function runProcess(spec: ProcessSpec): Promise<0 | 1> {
  const { kind, config, log } = spec;
  const signals = spec.signals ?? process;
  const tracked: Resource[] = [];
  let ready = false;
  let closing = 'nothing';
  let timer: NodeJS.Timeout | undefined;
  let signalCount = 0;

  let stop!: () => void;
  const stopped = new Promise<void>((resolve) => {
    stop = resolve;
  });
  let escalate!: (reason: string) => void;
  const escalated = new Promise<1>((resolve) => {
    escalate = (reason) => {
      log.error({ resource: closing, reason }, 'shutdown aborted');
      resolve(1);
    };
  });

  const health = createHealthServer({
    host: config.HEALTH_HOST,
    port: config.HEALTH_PORT,
    probeTimeoutMs: config.PROBE_TIMEOUT_MS,
    isReady: () => ready,
    probes: () => tracked.flatMap((r) => (r.probe ? [r.probe] : [])),
    tools: spec.tools,
  });

  const startBudget = (): void => {
    timer ??= setTimeout(() => {
      escalate('shutdown budget exceeded');
    }, config.SHUTDOWN_TIMEOUT_MS);
  };

  const onSignal = (): void => {
    signalCount += 1;
    if (signalCount === 1) {
      ready = false;
      log.info({ kind }, 'signal received');
      startBudget();
      stop();
    } else {
      escalate('second signal');
    }
  };
  for (const s of SIGNALS) signals.on(s, onSignal);

  const shutdown = async (): Promise<0 | 1> => {
    ready = false;
    let code: 0 | 1 = 0;
    for (const resource of [...tracked].reverse()) {
      closing = resource.name;
      try {
        await resource.close();
        log.info({ resource: resource.name }, 'resource closed');
      } catch (cause) {
        code = 1;
        log.error({ resource: resource.name, err: cause }, 'close failed');
      }
    }
    closing = 'health server';
    await health.close();
    log.info({ resource: closing }, 'resource closed');
    return code;
  };

  const finish = async (boot: 0 | 1): Promise<0 | 1> => {
    startBudget();
    const code = await Promise.race([shutdown(), escalated]);
    if (code === 1) void health.close();
    return boot === 1 ? 1 : code;
  };

  const exit = (code: 0 | 1): 0 | 1 => {
    clearTimeout(timer);
    for (const s of SIGNALS) signals.off(s, onSignal);
    log.info({ kind, code }, 'exit');
    return code;
  };

  log.info({ kind }, 'boot');
  try {
    await health.listen();
  } catch (cause) {
    log.error({ err: cause }, 'health server failed to listen');
    return exit(1);
  }

  let opened: Result<void>;
  try {
    opened = await spec.open((resource) => tracked.push(resource));
  } catch (cause) {
    opened = err(appError(ErrorCode.internal, 'open threw', cause));
  }
  if (!opened.ok) {
    log.error({ err: opened.error }, 'boot failed');
    return exit(await finish(1));
  }

  if (signalCount === 0) {
    ready = true;
    log.info({ kind }, 'ready');
  }
  await stopped;
  return exit(await finish(0));
}
