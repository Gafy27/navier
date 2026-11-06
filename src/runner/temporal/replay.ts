import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Worker } from '@temporalio/worker';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { workflowInterceptorsPath } from './worker.ts';

/**
 * Replays every `*.json` history in `dir` against the workflow code at
 * `workflowsPath`. Returns how many replayed, or `internal` on nondeterminism
 * or an empty folder.
 */
export async function replayHistories(
  workflowsPath: string,
  dir: string,
): Promise<Result<number>> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  if (names.length === 0) {
    return err(appError(ErrorCode.internal, `no histories in ${dir}`));
  }
  const histories = await Promise.all(
    names.map(async (name) => ({
      workflowId: name,
      history: JSON.parse(await readFile(join(dir, name), 'utf8')) as unknown,
    })),
  );
  for await (const result of Worker.runReplayHistories(
    {
      workflowsPath,
      interceptors: { workflowModules: [workflowInterceptorsPath] },
    },
    histories,
  )) {
    if (result.error !== undefined) {
      return err(
        appError(
          ErrorCode.internal,
          `replay failed for ${result.workflowId}`,
          result.error,
        ),
      );
    }
  }
  return ok(histories.length);
}
