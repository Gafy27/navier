import type { Db, OrgId } from '../db/index.ts';
import { runtimeView } from './tables.ts';

export const Approval = {
  never_ask: 'never_ask',
  low: 'low',
  medium: 'medium',
  high: 'high',
} as const;
export type Approval = (typeof Approval)[keyof typeof Approval];

const APPROVAL_ORDER = [
  Approval.never_ask,
  Approval.low,
  Approval.medium,
  Approval.high,
] as const;

/** `approval_memory.args_hash` when the row approves the whole key. */
const PER_KEY_ARGS_HASH = '';

export interface ApprovalMemory {
  readonly perKey: boolean;
  readonly argumentHashes: ReadonlySet<string>;
}

/** Higher index in `APPROVAL_ORDER` wins. */
function stricter(a: Approval, b: Approval): Approval {
  return APPROVAL_ORDER.indexOf(b) > APPROVAL_ORDER.indexOf(a) ? b : a;
}

function toApproval(value: unknown): Approval | null {
  if (typeof value !== 'string') return null;
  for (const stake of APPROVAL_ORDER) {
    if (stake === value) return stake;
  }
  return null;
}

/** An unrecognised entry stake fails closed to `high`. */
export function effectiveStake(snapshot: {
  entry: { approval: string };
  approval: unknown;
}): Approval {
  const entry = toApproval(snapshot.entry.approval) ?? 'high';
  const ref = toApproval(snapshot.approval);
  return ref === null ? entry : stricter(entry, ref);
}

export function approvalVerdict(
  stake: Approval,
  memory: ApprovalMemory,
  argsHash: string,
): 'run' | 'block' {
  if (stake === 'never_ask') return 'run';
  if (stake === 'low') return memory.perKey ? 'run' : 'block';
  if (stake === 'medium')
    return memory.argumentHashes.has(argsHash) ? 'run' : 'block';
  // `high`, and any stake cast in from outside `Approval`, blocks.
  return 'block';
}

export async function rememberedApprovals(
  db: Db,
  org: OrgId,
  agentId: string,
  toolKey: string,
): Promise<ApprovalMemory> {
  const rows = await runtimeView(db)
    .selectFrom('approval_memory')
    .select('args_hash')
    .where('org_id', '=', org)
    .where('agent_id', '=', agentId)
    .where('tool_key', '=', toolKey)
    .execute();

  let perKey = false;
  const argumentHashes = new Set<string>();
  for (const row of rows) {
    if (row.args_hash === PER_KEY_ARGS_HASH) perKey = true;
    else argumentHashes.add(row.args_hash);
  }
  return { perKey, argumentHashes };
}
