import { sleep } from '@temporalio/workflow';

/** `noop` after a change that adds a timer: it must not replay the stored history. */
export async function noop(): Promise<void> {
  await sleep(1);
}
