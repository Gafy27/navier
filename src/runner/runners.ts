import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { OrgId, Tx } from '../db/index.ts';
import type { TemporalHandle } from './temporal/index.ts';
import { ownerOf } from './owner.ts';
import { createTemporalRunner } from './temporal/adapter.ts';
import type { TemporalRunnerDeps } from './temporal/adapter.ts';
import type { TurnRef, TurnRunner } from './types.ts';

export interface Runners {
  readonly dbos?: TurnRunner;
  readonly temporal?: TurnRunner;
  forStart(org: OrgId): Result<TurnRunner>;
  ownerOf(tx: Tx, ref: TurnRef): Promise<Result<TurnRunner>>;
}

export interface RunnerParts {
  readonly dbos?: TurnRunner;
  readonly temporal?: TurnRunner;
  readonly startOn?: (org: OrgId) => TurnRunner['name'];
}

const unavailable = (name: TurnRunner['name']) =>
  err(appError(ErrorCode.unavailable, `${name} runner is not configured`));

export function createRunners(parts: RunnerParts): Runners {
  const pick = (name: TurnRunner['name']): Result<TurnRunner> => {
    const runner = name === 'dbos' ? parts.dbos : parts.temporal;
    return runner === undefined ? unavailable(name) : ok(runner);
  };
  const which = parts.startOn ?? (() => 'temporal' as const);
  const temporalOnly = parts.dbos === undefined;
  return {
    ...(parts.dbos !== undefined ? { dbos: parts.dbos } : {}),
    ...(parts.temporal !== undefined ? { temporal: parts.temporal } : {}),
    forStart: (org) => pick(which(org)),
    ownerOf: async (tx, ref) =>
      pick(temporalOnly ? 'temporal' : await ownerOf(tx, ref)),
  };
}

export function runnersForTemporal(
  handle: TemporalHandle,
  deps: TemporalRunnerDeps,
): Runners {
  return createRunners({ temporal: createTemporalRunner(handle, deps) });
}
