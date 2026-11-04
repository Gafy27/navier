import { accessSync, constants, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { parse } from 'yaml';

export type Resolved = {
  argv: string[];
  env: Record<string, string>;
  timeoutMs: number;
};
export type Resolution = { ok: true; value: Resolved } | { ok: false; reason: 'config'; detail: string };

const MS_PER_MINUTE = 60_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

function onPath(cmd: string): boolean {
  const dirs = cmd.includes('/') ? [''] : (process.env.PATH ?? '').split(delimiter);
  return dirs.some((dir) => {
    try {
      accessSync(dir === '' ? cmd : join(dir, cmd), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function roleModel(kit: string, role: string): string | undefined {
  try {
    const raw: unknown = parse(readFileSync(join(kit, 'agents', role, 'agent.yaml'), 'utf8'));
    return isRecord(raw) && typeof raw.model === 'string' ? raw.model : undefined;
  } catch {
    return undefined;
  }
}

const fail = (detail: string): Resolution => ({ ok: false, reason: 'config', detail });

// D5: nothing is spawned unless the role, model, harness entry and argv[0] all resolve.
export function resolveConfig(config: unknown, kit: string): Resolution {
  const cli = isRecord(config) && isRecord(config.cli) ? config.cli : undefined;
  if (cli === undefined) return fail('no cli section');
  if (typeof cli.agent !== 'string' || typeof cli.harness !== 'string') {
    return fail('cli.agent and cli.harness must be set');
  }
  const minutes = cli.turn_timeout_minutes;
  if (typeof minutes !== 'number' || !(minutes > 0)) {
    return fail('cli.turn_timeout_minutes must be a positive number');
  }
  const entry = isRecord(cli.harnesses) ? cli.harnesses[cli.harness] : undefined;
  if (!isRecord(entry) || !isStrings(entry.argv) || entry.argv.length === 0) {
    return fail(`no harness entry "${cli.harness}" with an argv`);
  }
  const model = typeof entry.model === 'string' ? entry.model : roleModel(kit, cli.agent);
  if (model === undefined) return fail(`no model for role "${cli.agent}"`);
  if (!onPath(entry.argv[0])) return fail(`${entry.argv[0]} is not on PATH`);

  const sub = (s: string): string => s.replaceAll('{model}', model);
  const env: Record<string, string> = {};
  if (isRecord(entry.env)) {
    for (const [k, v] of Object.entries(entry.env)) {
      if (typeof v !== 'string') return fail(`env ${k} must be a string`);
      env[k] = sub(v);
    }
  }
  return {
    ok: true,
    value: { argv: entry.argv.map(sub), env, timeoutMs: minutes * MS_PER_MINUTE },
  };
}
