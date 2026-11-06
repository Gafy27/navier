import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { z } from '../../../index.ts';
import type { Io } from '../../utils/context.ts';
import type { CliContext } from '../../utils/context.ts';
import { EXIT_OK } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import {
  DatabaseOrigin,
  databaseName,
  quoteIdentifier,
  requireDeskProject,
  writeServerFiles,
} from '../../utils/server-config.ts';

export const DbToken = z.enum({
  composeFile: 'docker-compose.yml',
  docker: 'docker',
  compose: 'compose',
  fileFlag: '-f',
  up: 'up',
  detach: '-d',
  wait: '--wait',
  postgresService: 'postgres',
  scheme: 'postgresql:',
  loopback: '127.0.0.1',
  superuser: 'postgres',
  maintenanceDatabase: 'postgres',
  serviceRole: 'agents_service',
  defaultName: 'agents',
  postgresPassword: 'POSTGRES_PASSWORD',
  servicePassword: 'POSTGRES_SERVICE_PASSWORD',
  selectOne: 'select 1',
});

const DbMessage = z.enum({
  noComposeFile: 'no docker-compose.yml found above the project folder',
  composeFailed: 'docker compose did not start postgres',
  queryFailed: 'the database refused the statement',
  taken: 'a database with that name exists: run cli db delete first',
});

/** The host port `docker-compose.yml` maps to the container's 5432 on loopback (D10). */
export const SUPERUSER_PORT = 55432;

/** The one `pg` seam: connect to a URL, run one statement, close. Tests pass a fake. */
export interface PgAccess {
  readonly run: (url: string, statement: string) => Promise<void>;
}

/** A failure never echoes the driver's text: it can hold the URL and its password. */
export const livePg: PgAccess = {
  run: async (url, statement) => {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query(statement);
    } catch {
      throw new CliFailure(DbMessage.enum.queryFailed);
    } finally {
      await client.end().catch(() => undefined);
    }
  },
};

/** Walks from `projectDir` toward `/` until a compose file exists (PD15). */
export function findComposeRoot(projectDir: string): string {
  for (let dir = projectDir; ; dir = dirname(dir)) {
    if (existsSync(join(dir, DbToken.enum.composeFile))) return dir;
    if (dirname(dir) === dir) {
      throw new CliUsage(DbMessage.enum.noComposeFile);
    }
  }
}

/** The variables a command may read: `CliEnv.vars`. Only entrypoints read `process.env`. */
export type HostVars = Readonly<Record<string, string | undefined>>;

/** A required variable, or a usage error naming it. The value is never printed. */
export function requiredVar(vars: HostVars, name: string): string {
  const value = vars[name];
  if (value === undefined || value.length === 0) {
    throw new CliUsage(`${name} is not set`);
  }
  return value;
}

/** A loopback URL on the compose host port. The setters encode the password. */
function localUrl(user: string, password: string, database: string): string {
  const url = new URL(
    `${DbToken.enum.scheme}//${DbToken.enum.loopback}:${String(SUPERUSER_PORT)}/${database}`,
  );
  url.username = user;
  url.password = password;
  return url.toString();
}

/** DDL goes through the superuser; the service role cannot create or drop a database it does not own. */
export function superuserUrl(vars: HostVars): string {
  return localUrl(
    DbToken.enum.superuser,
    requiredVar(vars, DbToken.enum.postgresPassword),
    DbToken.enum.maintenanceDatabase,
  );
}

function definedVars(vars: HostVars): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export async function runDbCreate(
  ctx: CliContext,
  args: { readonly name?: string },
  io: Io,
  pgAccess: PgAccess = livePg,
): Promise<number> {
  const { env } = ctx;
  const files = await requireDeskProject(env.projectDir);
  const name = databaseName(args.name ?? DbToken.enum.defaultName);
  if (files.secrets.databases[name] !== undefined) {
    throw new CliUsage(DbMessage.enum.taken);
  }
  const superuser = superuserUrl(env.vars);
  const servicePassword = requiredVar(env.vars, DbToken.enum.servicePassword);
  const root = findComposeRoot(env.projectDir);
  const child = env.spawn(
    DbToken.enum.docker,
    [
      DbToken.enum.compose,
      DbToken.enum.fileFlag,
      join(root, DbToken.enum.composeFile),
      DbToken.enum.up,
      DbToken.enum.detach,
      DbToken.enum.wait,
      DbToken.enum.postgresService,
    ],
    { env: definedVars(env.vars), cwd: root },
  );
  for await (const line of child.lines) io.stdout(`${line}\n`);
  if ((await child.exited) !== EXIT_OK) {
    throw new CliFailure(DbMessage.enum.composeFailed);
  }
  await pgAccess.run(
    superuser,
    `CREATE DATABASE ${quoteIdentifier(name)} OWNER ${quoteIdentifier(DbToken.enum.serviceRole)}`,
  );
  const url = localUrl(DbToken.enum.serviceRole, servicePassword, name);
  await writeServerFiles(env.projectDir, {
    config: files.config,
    secrets: {
      ...files.secrets,
      databases: {
        ...files.secrets.databases,
        [name]: { url, origin: DatabaseOrigin.enum.create },
      },
      attached: url,
    },
  });
  io.stdout(`created ${name}\n`);
  return EXIT_OK;
}
