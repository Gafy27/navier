import { sql } from 'kysely';
import { z } from '../../index.ts';
import type { Logger } from '../../index.ts';
import { parseOrgId } from '../../db/index.ts';
import type { Db, OrgId } from '../../db/index.ts';
import { turnWorkflowId } from '../../runtime/workflow-id.ts';

/** D7: how often the hub re-reads stop rows while its listener is down. */
export const StopHubConfigSchema = z.object({
  pollIntervalMs: z.number().int().min(1).default(1_000),
});

const HUB = StopHubConfigSchema.parse({});

/** What the hub needs from a LISTEN connection; the worker adapts `createListener` to it (PD2). */
export interface ListenerEvents {
  onPayload(workflowId: string): void;
  /** The connection is listening: first connect or a reconnect. Stops since the last one may be missed. */
  onUp(): void;
  onDown(): void;
}

export type ListenerFactory = (events: ListenerEvents) => {
  readonly close: () => Promise<void>;
};

export interface StopHub {
  /** D2: register first, then read the stop row; abort fires once a stop is seen. */
  register(workflowId: string): { signal: AbortSignal; release(): void };
  close(): Promise<void>;
}

interface TurnKey {
  readonly org: OrgId;
  readonly messageId: string;
}

/** `turn~<org>~<thread>~<message>` back into its ids; `undefined` unless it is exactly `turnWorkflowId`'s output. */
function parseTurnKey(workflowId: string): TurnKey | undefined {
  const [, rawOrg, threadId, messageId, ...rest] = workflowId.split('~');
  const org = parseOrgId(rawOrg);
  if (!org.ok || threadId === undefined || messageId === undefined) {
    return undefined;
  }
  const exact =
    rest.length === 0 &&
    turnWorkflowId(org.value, threadId, messageId) === workflowId;
  return exact ? { org: org.value, messageId } : undefined;
}

/** The stop row's key; the hub reads no other column. */
const StopRowsSchema = z.array(
  z.object({ org_id: z.string(), message_id: z.string() }),
);

const PgCodeSchema = z.object({ code: z.string() });

/**
 * D2, D7, PD2: one hub per worker. A notification aborts the registered steps of
 * that workflow. A reconnect, and every poll while the listener is down, re-read the
 * stop rows of all registered workflows, so no stop is lost.
 */
export function createStopHub(
  db: Db,
  listen: ListenerFactory,
  log: Logger,
): StopHub {
  const controllers = new Map<string, Set<AbortController>>();
  let scanning = false;
  let poll: NodeJS.Timeout | undefined;
  let closed = false;

  const abortAll = (workflowId: string): void => {
    for (const controller of controllers.get(workflowId) ?? []) {
      controller.abort();
    }
  };

  const scan = async (): Promise<void> => {
    if (scanning || controllers.size === 0) return;
    scanning = true;
    try {
      const turns: { key: TurnKey; workflowId: string }[] = [];
      for (const workflowId of controllers.keys()) {
        const key = parseTurnKey(workflowId);
        if (key !== undefined) turns.push({ key, workflowId });
      }
      if (turns.length === 0) return;
      const { rows } = await sql`
        select org_id, message_id from stop_requested
        where ${sql.join(
          turns.map(
            ({ key }) =>
              sql`(org_id = ${key.org} and message_id = ${key.messageId})`,
          ),
          sql` or `,
        )}
      `.execute(db);
      const stopped = StopRowsSchema.parse(rows);
      const workflowForStopRow = new Map(
        turns.map((t) => [`${t.key.org}\0${t.key.messageId}`, t.workflowId]),
      );
      for (const row of stopped) {
        const wf = workflowForStopRow.get(`${row.org_id}\0${row.message_id}`);
        if (wf !== undefined) abortAll(wf);
      }
    } catch (e) {
      const code = PgCodeSchema.safeParse(e);
      log.warn(
        { code: code.success ? code.data.code : undefined },
        'stop re-read failed',
      );
    } finally {
      scanning = false;
    }
  };

  const startPolling = (): void => {
    if (closed || poll !== undefined) return;
    poll = setInterval(() => void scan(), HUB.pollIntervalMs);
    poll.unref();
  };
  const stopPolling = (): void => {
    clearInterval(poll);
    poll = undefined;
  };

  // The listener is down until it says it is up (D7).
  startPolling();
  const listener = listen({
    onPayload: abortAll,
    onUp: () => {
      stopPolling();
      void scan();
    },
    onDown: startPolling,
  });

  return {
    register: (workflowId) => {
      const controller = new AbortController();
      const set = controllers.get(workflowId) ?? new Set<AbortController>();
      set.add(controller);
      controllers.set(workflowId, set);
      return {
        signal: controller.signal,
        release: () => {
          set.delete(controller);
          if (set.size === 0 && controllers.get(workflowId) === set) {
            controllers.delete(workflowId);
          }
        },
      };
    },
    close: async () => {
      closed = true;
      stopPolling();
      await listener.close();
    },
  };
}
