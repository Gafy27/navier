import type { Command } from 'commander';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { z } from '../../../index.ts';
import type { CliContext, CliEnv } from '../../utils/context.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import {
  ServerFile,
  ServerVariable,
  VARIABLES,
  childEnv,
  writeServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles } from '../../utils/server-config.ts';
import {
  MigrateToken,
  MIGRATE_ERROR_EXIT,
  NODE_BINARY,
} from '../migrate/index.ts';

export const InitToken = z.enum({
  command: 'init',
  discoveryPath: '/.well-known/openid-configuration',
  tcpPrefix: 'tcp://',
  connect: 'connect',
  error: 'error',
});

export const InitMessage = z.enum({
  description:
    'write config.yaml and .secrets/server.json for the desk project',
  postgres: 'Postgres did not connect',
  temporal: 'Temporal did not answer',
  idp: 'the IdP discovery URL did not resolve',
  authz: 'authz-api did not answer',
});

const Scheme = z.enum({ https: 'https:', http: 'http:' });
const DEFAULT_PORTS: Readonly<Record<string, number>> = {
  [Scheme.enum.https]: 443,
  [Scheme.enum.http]: 80,
};
const TRAILING_SLASH = /\/$/u;

function emptyAnswer(name: string): string {
  return `${name} is empty`;
}

function wroteLine(): string {
  const secrets = join(ServerFile.enum.secretsDir, ServerFile.enum.secretsFile);
  return `wrote ${ServerFile.enum.config} and ${secrets}\n`;
}

/** Each check passes or fails. The live ones are `liveInitChecks`; tests pass fakes. */
export interface InitChecks {
  readonly postgres: (files: ServerFiles) => Promise<boolean>;
  readonly temporal: (files: ServerFiles) => Promise<boolean>;
  readonly idp: (files: ServerFiles) => Promise<boolean>;
  readonly authz: (files: ServerFiles) => Promise<boolean>;
}

/** The value a name holds in either file. A name not written yet reads as absent. */
function valueOf(files: ServerFiles, name: ServerVariable): string | undefined {
  const value = files.config.env[name] ?? files.secrets.env[name];
  return value === undefined ? undefined : String(value);
}

function parseUrl(address: string): URL | undefined {
  try {
    return new URL(address);
  } catch {
    return undefined;
  }
}

function connects(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.once(InitToken.enum.connect, () => {
      socket.destroy();
      resolve(true);
    });
    socket.once(InitToken.enum.error, () => {
      resolve(false);
    });
  });
}

/** A TCP reach check against a URL's host and port. It sets no timeout: the OS connect limit applies. */
function tcpReachable(url: string | undefined): Promise<boolean> {
  const target = url === undefined ? undefined : parseUrl(url);
  if (target === undefined) return Promise.resolve(false);
  const port = Number(target.port || DEFAULT_PORTS[target.protocol]);
  return Number.isInteger(port)
    ? connects(target.hostname, port)
    : Promise.resolve(false);
}

function temporalReachable(files: ServerFiles): Promise<boolean> {
  const address = valueOf(files, ServerVariable.enum.TEMPORAL_ADDRESS);
  return tcpReachable(
    address === undefined ? undefined : `${InitToken.enum.tcpPrefix}${address}`,
  );
}

async function discoveryResolves(
  env: CliEnv,
  files: ServerFiles,
): Promise<boolean> {
  const issuer = valueOf(files, ServerVariable.enum.IDP_ISSUER);
  if (issuer === undefined) return false;
  try {
    const base = issuer.replace(TRAILING_SLASH, '');
    return (await env.fetch(`${base}${InitToken.enum.discoveryPath}`)).ok;
  } catch {
    return false;
  }
}

/** Exit 0 (current) and 1 (pending) both mean the database answered. The output is not read: a line can name a connection detail. */
async function postgresConnects(
  env: CliEnv,
  files: ServerFiles,
): Promise<boolean> {
  const child = env.spawn(
    NODE_BINARY,
    [MigrateToken.enum.entry, MigrateToken.enum.checkFlag],
    { env: childEnv(files), cwd: env.projectDir },
  );
  return (await child.exited) !== MIGRATE_ERROR_EXIT;
}

export function liveInitChecks(env: CliEnv): InitChecks {
  return {
    postgres: (files) => postgresConnects(env, files),
    temporal: (files) => temporalReachable(files),
    idp: (files) => discoveryResolves(env, files),
    authz: (files) =>
      tcpReachable(valueOf(files, ServerVariable.enum.AUTHZ_API_URL)),
  };
}

/** Prompts each required row: secrets with `password`, the rest with `text`. */
async function askRequired(env: CliEnv): Promise<ServerFiles> {
  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const row of VARIABLES) {
    if (!row.required) continue;
    const question = { message: row.name, flag: row.name };
    const answer = row.secret
      ? await env.prompter.password(question)
      : await env.prompter.text(question);
    if (answer.length === 0) throw new CliUsage(emptyAnswer(row.name));
    if (row.secret) {
      secrets[row.name] = answer;
    } else {
      config[row.name] = answer;
    }
  }
  return {
    config: { env: config, workers: [] },
    secrets: { env: secrets, databases: {} },
  };
}

async function verify(checks: InitChecks, files: ServerFiles): Promise<void> {
  if (!(await checks.postgres(files))) {
    throw new CliFailure(InitMessage.enum.postgres);
  }
  if (!(await checks.temporal(files))) {
    throw new CliFailure(InitMessage.enum.temporal);
  }
  if (!(await checks.idp(files))) throw new CliFailure(InitMessage.enum.idp);
  if (!(await checks.authz(files))) {
    throw new CliFailure(InitMessage.enum.authz);
  }
}

/** Writes both files only when every check passes (D6). */
export async function runInit(env: CliEnv, checks: InitChecks): Promise<void> {
  const files = await askRequired(env);
  await verify(checks, files);
  await writeServerFiles(env.projectDir, files);
  env.io.stdout(wroteLine());
}

export function registerInit(program: Command, ctx: CliContext): void {
  program
    .command(InitToken.enum.command)
    .description(InitMessage.enum.description)
    .action(async () => {
      await runInit(ctx.env, liveInitChecks(ctx.env));
    });
}
