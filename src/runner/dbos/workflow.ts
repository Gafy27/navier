import type { OrgId } from '../../db/index.ts';
import { z } from '../../index.ts';
import { MessageStatus } from '../../runtime/status.ts';
import type { TerminalStatus } from '../../runtime/status.ts';
import { StopAbort } from './steps.ts';
import type {
  LoadedTurn,
  ModelStepOutcome,
  RunnableAction,
  ServiceLimits,
} from '../../runtime/workflow-types.ts';

/** L2: ids and limits only. */
export interface DbosTurnInput {
  readonly org: OrgId;
  readonly threadId: string;
  readonly agentMessageId: string;
  readonly traceId?: string;
  readonly service: ServiceLimits;
}

type StopKind = 'cancel' | 'interrupt';
type Paused = { pausedSeq: number; expiresAtEpochMs: number };

const HardStopSchema = z.enum(['cancel', 'interrupt']);

/**
 * D5: everything the body touches. Each member is a DBOS step or primitive
 * (`runStep` wrappers P2.2, `checkStop` P2.3, `recv` wait P2.4, `setEvent` D7),
 * bound per workflow id by the worker. A step failure throws; the body never
 * reads a clock, random, env or the database itself.
 */
export interface TurnPorts {
  readonly workflowId: string;
  loadTurn(): Promise<LoadedTurn>;
  /** Only used when `loadTurn` says the message is already finished. */
  currentStatus(): Promise<MessageStatus>;
  checkStop(stepIndex: number): Promise<'none' | StopKind | 'graceful'>;
  modelStep(stepIndex: number, runKey: string): Promise<ModelStepOutcome>;
  /** P2.2 D6: true when an action blocked. */
  toolPool(
    actions: readonly RunnableAction[],
    concurrency: number,
  ): Promise<boolean>;
  pauseTurn(): Promise<Paused>;
  waitForDecision(paused: Paused): Promise<'resume' | StopKind | 'expired'>;
  finishTurn(end: End): Promise<void>;
  /** D7: `setEvent('status', status)`. */
  setStatus(status: MessageStatus): Promise<void>;
}

export interface End {
  readonly status: TerminalStatus;
  readonly reason: string | null;
}

/** A run that blocked: `stepIndex` is the boundary the stop check after the wait uses. */
interface PausedRun {
  readonly paused: true;
  readonly stepIndex: number;
}
type LoopEnd = End | PausedRun | 'finished';

const isPaused = (out: LoopEnd): out is PausedRun =>
  typeof out === 'object' && 'paused' in out;

function stopEnd(kind: StopKind | 'graceful'): End {
  const status = {
    cancel: MessageStatus.cancelled,
    interrupt: MessageStatus.interrupted,
    graceful: MessageStatus.gracefully_stopped,
  }[kind];
  return { status, reason: null };
}

/** D4: a non-retryable model failure is a refusal; anything else a failure. */
function failureEnd(e: unknown): End {
  const refused =
    typeof e === 'object' &&
    e !== null &&
    'nonRetryable' in e &&
    e.nonRetryable === true;
  return {
    status: MessageStatus.errored,
    reason: refused ? 'model_refused' : 'model_failed',
  };
}

/** A hub abort travels as `StopAbort`; a thrown copy keeps only its name. */
const isStopAbort = (e: unknown): boolean =>
  e instanceof Error && e.name === StopAbort.name;

/** D4: an aborted step ends as the stop row says; no stop row means the abort is a real failure. */
async function endAfterAbort(
  ports: TurnPorts,
  stepIndex: number,
  e: unknown,
): Promise<End> {
  const stop = await ports.checkStop(stepIndex);
  const hard = HardStopSchema.safeParse(stop);
  if (hard.success) return stopEnd(hard.data);
  throw e;
}

/** `true` when an action blocked, an `End` when the hub aborted the pool (D4). */
async function pool(
  ports: TurnPorts,
  stepIndex: number,
  actions: readonly RunnableAction[],
  concurrency: number,
): Promise<boolean | End> {
  try {
    return await ports.toolPool(actions, concurrency);
  } catch (e) {
    if (!isStopAbort(e)) throw e;
    return endAfterAbort(ports, stepIndex, e);
  }
}

/** D3: load → pending → loop. Throws only for a failed non-model step; `runTurn` catches. */
async function loop(ports: TurnPorts): Promise<LoopEnd> {
  const loaded = await ports.loadTurn();
  if (loaded.kind === 'finished') return 'finished';
  const { maxSteps, toolCallConcurrency } = loaded;

  let stepIndex = loaded.nextStep;
  let blocked = await pool(
    ports,
    stepIndex,
    loaded.pending,
    toolCallConcurrency,
  );
  if (typeof blocked === 'object') return blocked;
  if (blocked || loaded.waiting === true) return { paused: true, stepIndex };

  while (stepIndex < maxSteps) {
    const stop = await ports.checkStop(stepIndex);
    if (stop !== 'none') return stopEnd(stop);

    let step: ModelStepOutcome;
    try {
      step = await ports.modelStep(stepIndex, ports.workflowId);
    } catch (e) {
      return isStopAbort(e)
        ? endAfterAbort(ports, stepIndex, e)
        : failureEnd(e);
    }
    if (step.done) return { status: MessageStatus.succeeded, reason: null };
    if (step.waiting === true) return { paused: true, stepIndex };

    blocked = await pool(ports, stepIndex, step.runnable, toolCallConcurrency);
    if (typeof blocked === 'object') return blocked;
    if (blocked) return { paused: true, stepIndex };
    stepIndex += 1;
  }
  return { status: MessageStatus.max_steps, reason: null };
}

/** One turn. Every exit but "already finished" runs `finishTurn` (D4). */
export async function runTurn(ports: TurnPorts): Promise<MessageStatus> {
  let end: End | 'finished';
  try {
    end = await settle(ports);
  } catch {
    end = { status: MessageStatus.errored, reason: 'workflow_failed' };
  }
  if (end === 'finished') return ports.currentStatus();
  await ports.finishTurn(end);
  await ports.setStatus(end.status);
  return end.status;
}

/** Runs the loop; on a pause waits for a decision and loops again (P2.4). */
async function settle(ports: TurnPorts): Promise<End | 'finished'> {
  for (;;) {
    const out = await loop(ports);
    if (!isPaused(out)) return out;

    const paused = await ports.pauseTurn();
    await ports.setStatus(MessageStatus.paused);
    const decision = await ports.waitForDecision(paused);
    const fromDecision = HardStopSchema.safeParse(decision);
    if (fromDecision.success) return stopEnd(fromDecision.data);
    // L1: a committed stop row wins over a decision or expiry that arrived in the same wait.
    const stop = await ports.checkStop(out.stepIndex);
    const fromRow = HardStopSchema.safeParse(stop);
    if (fromRow.success) return stopEnd(fromRow.data);
    if (decision === 'expired') {
      return { status: MessageStatus.expired, reason: 'pause_timeout' };
    }
  }
}

/**
 * The registered body (`register.ts`). The worker binds ports per workflow id
 * once P2.2–P2.4 land; until then no port source exists.
 */
export type PortsFor = (input: DbosTurnInput) => TurnPorts;

let portsFor: PortsFor | undefined;

export function bindTurnPorts(factory: PortsFor): void {
  portsFor = factory;
}

export function turnWorkflow(input: DbosTurnInput): Promise<MessageStatus> {
  if (portsFor === undefined) {
    return Promise.reject(new Error('turn ports are not bound'));
  }
  return runTurn(portsFor(input));
}
