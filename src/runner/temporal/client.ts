import { Client, Connection } from '@temporalio/client';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Logger, Result } from '../../index.ts';
import type { TemporalConfig } from '../../config.ts';
import { clientInterceptor } from './trace.ts';

/** The Temporal client for one namespace, and the way to close its connection. */
export interface TemporalHandle {
  readonly client: Client;
  readonly close: () => Promise<void>;
}

/** Opens one connection and one client. An unreachable server is `unavailable`, never a throw. */
export async function connectTemporal(
  config: TemporalConfig,
  log: Logger,
): Promise<Result<TemporalHandle>> {
  let connection: Connection;
  try {
    connection = await Connection.connect({ address: config.TEMPORAL_ADDRESS });
  } catch (cause) {
    log.warn({ err: cause }, 'temporal unreachable');
    return err(
      appError(ErrorCode.unavailable, 'temporal is unreachable', cause),
    );
  }
  const client = new Client({
    connection,
    namespace: config.TEMPORAL_NAMESPACE,
    interceptors: { workflow: [clientInterceptor] },
  });
  return ok({ client, close: () => connection.close() });
}
