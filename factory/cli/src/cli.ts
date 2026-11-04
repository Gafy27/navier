import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { EXIT, loadStatus, runPhase, runsDir } from './run.ts';
import { statusPath } from './status.ts';

const USAGE = 'usage: cli.ts list | status <phase-dir> | run <phase-dir>';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const root = dirname(kit);
const err = (line: string): void => void process.stderr.write(`${line}\n`);

function loadConfig(): unknown {
  const path = process.env.FACTORY_CONFIG ?? join(kit, 'config.yaml');
  return parse(readFileSync(path, 'utf8'));
}

// Paths stay as configured, so each line can be passed back to `run`.
function phaseDirs(designs: string): string[] {
  return readdirSync(resolve(root, designs))
    .map((name) => join(designs, name))
    .filter((dir) => statSync(resolve(root, dir)).isDirectory())
    .filter((dir) => readdirSync(resolve(root, dir)).some((f) => f.endsWith('_TICKETS.md')));
}

async function main(argv: string[]): Promise<number> {
  const [cmd, arg, ...rest] = argv;
  const needsDir = cmd === 'status' || cmd === 'run';
  if ((cmd !== 'list' && !needsDir) || rest.length > 0 || (needsDir ? arg === undefined : arg !== undefined)) {
    err(USAGE);
    return EXIT.usage;
  }
  let config: unknown;
  try {
    config = loadConfig();
  } catch (e) {
    err(`config: ${String(e)}`);
    return EXIT.usage;
  }

  if (cmd === 'list') {
    const designs = (config as { paths?: { designs?: unknown } } | null)?.paths?.designs;
    if (typeof designs !== 'string' || !existsSync(resolve(root, designs))) {
      err('config: paths.designs is not a directory');
      return EXIT.usage;
    }
    for (const dir of phaseDirs(designs)) console.log(dir);
    return EXIT.ok;
  }

  const phaseDir = resolve(root, arg as string);
  if (!existsSync(phaseDir) || !statSync(phaseDir).isDirectory()) {
    err(`not a directory: ${phaseDir}`);
    return EXIT.usage;
  }
  const runs = runsDir(config, root);
  if (runs === undefined) {
    err('config: paths.runs is not set');
    return EXIT.usage;
  }
  if (cmd === 'status') {
    const tickets = loadStatus(statusPath(runs, phaseDir), phaseDir).tickets;
    for (const r of tickets) {
      console.log(`${r.anexo} ${r.n} ${r.status}${r.reason === undefined ? '' : ` ${r.reason}`}`);
    }
    console.log(`done ${tickets.filter((r) => r.status === 'done').length}/${tickets.length}`);
    return EXIT.ok;
  }

  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  process.once('SIGTERM', () => abort.abort());
  return runPhase({ config, kit, root, phaseDir, signal: abort.signal, log: err });
}

process.exitCode = await main(process.argv.slice(2));
