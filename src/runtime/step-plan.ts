import type { ActionStatus } from './actions.ts';

export interface StepAction {
  readonly id: string;
  readonly status: ActionStatus;
  readonly approved: boolean;
}

function isOpen(action: StepAction): boolean {
  return action.status === 'created' || action.status === 'running';
}

export function stepPlan(actions: readonly StepAction[]): {
  readonly run: string[];
  readonly waiting: boolean;
} {
  const hasBlocked = actions.some((a) => a.status === 'blocked');
  if (hasBlocked) {
    const run = actions.filter((a) => isOpen(a) && a.approved).map((a) => a.id);
    return { run, waiting: true };
  }
  const run = actions.filter(isOpen).map((a) => a.id);
  return { run, waiting: false };
}
