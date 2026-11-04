import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { runTurn } from './acp.ts';
import { resolveConfig } from './config.ts';
import { buildStatus, parseStatus, setRow, settle, Status, statusPath, writeStatus } from './status.ts';
import type { Row, StatusFile, TurnOutcome } from './status.ts';
import { listAnexos } from './tickets.ts';

export const EXIT = { ok: 0, stopped: 1, usage: 2, interrupted: 130 } as const;

export type RunInput = {
  config: unknown;
  kit: string;
  root: string;
  phaseDir: string;
  signal: AbortSignal;
  log: (line: string) => void;
};

const readText = (path: string): string | undefined => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

export function runsDir(config: unknown, root: string): string | undefined {
  const paths = (config as { paths?: { runs?: unknown } } | null)?.paths;
  return typeof paths?.runs === 'string' ? resolve(root, paths.runs) : undefined;
}

// The status file rebuilt from the markdown, keeping rows that still exist.
export function loadStatus(path: string, phaseDir: string): StatusFile {
  const text = readText(path);
  return buildStatus(basename(phaseDir), listAnexos(phaseDir), text === undefined ? undefined : parseStatus(text));
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// O_EXCL create; a lock whose pid is dead is replaced. Returns false when a live run holds it.
function takeLock(lock: string): boolean {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      const pid = Number(readText(lock));
      if (Number.isInteger(pid) && pid > 0 && alive(pid)) return false;
      unlinkSync(lock);
    }
  }
  return false;
}

export async function runPhase(i: RunInput): Promise<number> {
  const runs = runsDir(i.config, i.root);
  if (runs === undefined) {
    i.log('config: paths.runs is not set');
    return EXIT.usage;
  }
  const path = statusPath(runs, i.phaseDir);
  const sessions = new Map(listAnexos(i.phaseDir).map((a) => [a.name, a.sessions]));
  const lock = join(runs, basename(i.phaseDir), 'run.lock');
  mkdirSync(dirname(lock), { recursive: true });
  if (!takeLock(lock)) {
    i.log(`run: ${lock} is held by a live run`);
    return EXIT.usage;
  }
  try {
    let status = loadStatus(path, i.phaseDir);
    // V15: rows left running by a dead run stay stopped for the rest of this run.
    const stale = status.tickets.filter((t) => t.status === Status.running);
    for (const r of stale) status = setRow(status, r, Status.stopped, 'no result');
    writeStatus(path, status);
    const isStale = (r: Row): boolean => stale.some((s) => s.anexo === r.anexo && s.n === r.n);
    const next = (): Row | undefined => status.tickets.find((t) => t.status !== Status.done && !isStale(t));

    for (let row = next(); row !== undefined; row = next()) {
      const key = { anexo: row.anexo, n: row.n };
      const label = `${row.anexo} #${row.n}`;
      const snapshot = setRow(status, key, Status.running);
      writeStatus(path, snapshot);
      i.log(`start ${label}`);

      const resolved = resolveConfig(i.config, i.kit);
      const fence = sessions.get(row.anexo)?.find((s) => s.n === row.n)?.prompt ?? '';
      let outcome: TurnOutcome = { kind: 'early', reason: 'config' };
      let interrupted = false;
      if (!resolved.ok) {
        i.log(`config: ${resolved.detail}`);
      } else {
        const turn = await runTurn({
          resolved: resolved.value,
          kit: i.kit,
          cwd: i.root,
          fence,
          statusPath: path,
          anexo: row.anexo,
          n: row.n,
          signal: i.signal,
        });
        interrupted = turn.kind === 'interrupted';
        outcome = turn.kind === 'returned' ? { kind: 'returned' } : { kind: 'early', reason: turn.reason };
      }

      status = settle(snapshot, readText(path), key, outcome);
      writeStatus(path, status);
      const after = status.tickets.find((t) => t.anexo === row.anexo && t.n === row.n);
      i.log(`settle ${label}: ${after?.status}${after?.reason === undefined ? '' : ` (${after.reason})`}`);
      if (interrupted) return EXIT.interrupted;
      if (after?.status !== Status.done) return EXIT.stopped;
    }
    return stale.length > 0 ? EXIT.stopped : EXIT.ok;
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      // already gone
    }
  }
}
