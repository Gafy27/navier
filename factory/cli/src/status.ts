import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import type { Anexo } from './tickets.ts';

export const Status = {
  pending: 'pending',
  running: 'running',
  done: 'done',
  stopped: 'stopped',
} as const;
export type StatusName = (typeof Status)[keyof typeof Status];

export type Row = { anexo: string; n: number; status: StatusName; reason?: string };
export type StatusFile = { phase: string; tickets: Row[] };
export type TurnOutcome = { kind: 'returned' } | { kind: 'early'; reason: string };

export const REASON_MAX = 2000;

const NAMES: string[] = Object.values(Status);

const cut = (reason: string): string => reason.slice(0, REASON_MAX);

function parseRow(raw: unknown): Row | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.anexo !== 'string' || !Number.isInteger(r.n)) return undefined;
  if (typeof r.status !== 'string' || !NAMES.includes(r.status)) return undefined;
  if (r.reason !== undefined && typeof r.reason !== 'string') return undefined;
  const row: Row = { anexo: r.anexo, n: r.n as number, status: r.status as StatusName };
  if (r.reason !== undefined) row.reason = cut(r.reason);
  return row;
}

// Returns undefined when the text is not YAML or lacks the status shape.
export function parseStatus(text: string): StatusFile | undefined {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const f = raw as Record<string, unknown>;
  if (typeof f.phase !== 'string' || !Array.isArray(f.tickets)) return undefined;
  const tickets: Row[] = [];
  for (const item of f.tickets) {
    const row = parseRow(item);
    if (row === undefined) return undefined;
    tickets.push(row);
  }
  return { phase: f.phase, tickets };
}

export function statusPath(runs: string, phaseDir: string): string {
  return join(runs, basename(phaseDir), 'status.yaml');
}

export function writeStatus(path: string, status: StatusFile): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, stringify(status));
  renameSync(tmp, path);
}

// Keeps status and reason of rows that still exist, adds new ones as pending.
export function buildStatus(
  phase: string,
  anexos: Anexo[],
  previous: StatusFile | undefined,
): StatusFile {
  const tickets: Row[] = [];
  for (const anexo of anexos) {
    for (const s of anexo.sessions) {
      const old = previous?.tickets.find((r) => r.anexo === anexo.name && r.n === s.n);
      tickets.push(old ?? { anexo: anexo.name, n: s.n, status: Status.pending });
    }
  }
  return { phase, tickets };
}

export function nextRow(status: StatusFile): Row | undefined {
  return status.tickets.find((r) => r.status !== Status.done);
}

export function setRow(
  status: StatusFile,
  key: { anexo: string; n: number },
  to: StatusName,
  reason?: string,
): StatusFile {
  const tickets = status.tickets.map((r): Row => {
    if (r.anexo !== key.anexo || r.n !== key.n) return r;
    return reason === undefined
      ? { anexo: r.anexo, n: r.n, status: to }
      : { anexo: r.anexo, n: r.n, status: to, reason: cut(reason) };
  });
  return { phase: status.phase, tickets };
}

function sameOthers(a: Row[], b: Row[], key: { anexo: string; n: number }): boolean {
  const rest = (rows: Row[]) =>
    rows.filter((r) => r.anexo !== key.anexo || r.n !== key.n);
  const x = rest(a);
  const y = rest(b);
  return (
    a.length === b.length &&
    x.length === y.length &&
    x.every((r, i) => r.anexo === y[i].anexo && r.n === y[i].n &&
      r.status === y[i].status && r.reason === y[i].reason)
  );
}

// What to write after a turn. `current` is the status file's text now.
export function settle(
  snapshot: StatusFile,
  current: string | undefined,
  key: { anexo: string; n: number },
  outcome: TurnOutcome,
): StatusFile {
  if (outcome.kind === 'early') return setRow(snapshot, key, Status.stopped, outcome.reason);
  const after = current === undefined ? undefined : parseStatus(current);
  if (after === undefined) return setRow(snapshot, key, Status.stopped, 'bad status');
  if (!sameOthers(snapshot.tickets, after.tickets, key)) {
    return setRow(snapshot, key, Status.stopped, 'other rows');
  }
  const mine = after.tickets.find((r) => r.anexo === key.anexo && r.n === key.n);
  if (mine?.status === Status.done) return setRow(snapshot, key, Status.done);
  if (mine?.status === Status.stopped) {
    return setRow(snapshot, key, Status.stopped, mine.reason);
  }
  return setRow(snapshot, key, Status.stopped, 'no result');
}
