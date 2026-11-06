import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext, Io } from '../../utils/context.ts';
import { EXIT_OK } from '../../utils/constants.ts';
import { CliUsage } from '../../utils/failure.ts';
import {
  DatabaseOrigin,
  databaseNameOfUrl,
  maskUrl,
  quoteIdentifier,
  requireDeskProject,
  writeServerFiles,
} from '../../utils/server-config.ts';
import type { ServerFiles } from '../../utils/server-config.ts';
import { DbToken, livePg, runDbCreate, superuserUrl } from './create.ts';
import type { PgAccess } from './create.ts';

export const DbCommand = z.enum({
  db: 'db',
  create: 'create',
  list: 'list',
  show: 'show',
  use: 'use',
  delete: 'delete',
});

const DbText = z.enum({
  description: 'manage the local desk databases',
  createDescription: 'start compose Postgres and create a database',
  listDescription: 'list the databases the desk knows',
  showDescription: 'show one database URL, password masked',
  useDescription: 'attach an existing database by URL',
  deleteDescription: 'drop a created database, or detach a used one',
  nameFlag: '--name <name>',
  nameDescription: 'database name',
  showSecretsFlag: '--show-secrets',
  showSecretsDescription: 'print the password in full',
  nameArgument: '<name>',
  yesOption: 'yes',
  urlFlag: 'url',
  urlPrompt: 'database URL',
  confirmDelete: 'delete the database entry?',
  attachedMark: 'attached, fills DATABASE_URL',
  taken: 'a database with that name uses another URL: run cli db delete first',
  missing: 'no such database entry',
  noUrl: 'missing database URL on stdin',
});

function entryOf(
  files: ServerFiles,
  name: string,
): ServerFiles['secrets']['databases'][string] {
  const entry = files.secrets.databases[name];
  if (entry === undefined) throw new CliUsage(DbText.enum.missing);
  return entry;
}

/** One line per entry. It never prints a URL. */
export async function runDbList(ctx: CliContext, io: Io): Promise<number> {
  const { secrets } = await requireDeskProject(ctx.env.projectDir);
  for (const [name, entry] of Object.entries(secrets.databases)) {
    const mark =
      entry.url === secrets.attached ? ` ${DbText.enum.attachedMark}` : '';
    io.stdout(`${name} ${entry.origin}${mark}\n`);
  }
  return EXIT_OK;
}

export async function runDbShow(
  ctx: CliContext,
  args: { readonly name: string; readonly showSecrets: boolean },
  io: Io,
): Promise<number> {
  const files = await requireDeskProject(ctx.env.projectDir);
  const { url } = entryOf(files, args.name);
  io.stdout(`${args.showSecrets ? url : maskUrl(url)}\n`);
  return EXIT_OK;
}

/** The URL comes from a masked prompt on a TTY, otherwise from stdin. */
async function readUrl(ctx: CliContext): Promise<string> {
  const { io, prompter } = ctx.env;
  const url = io.isTTY
    ? await prompter.password({
        message: DbText.enum.urlPrompt,
        flag: DbText.enum.urlFlag,
      })
    : (await io.stdin()).trim();
  if (url.length === 0) throw new CliUsage(DbText.enum.noUrl);
  return url;
}

export async function runDbUse(
  ctx: CliContext,
  io: Io,
  pgAccess: PgAccess = livePg,
): Promise<number> {
  const files = await requireDeskProject(ctx.env.projectDir);
  const url = await readUrl(ctx);
  const name = databaseNameOfUrl(url);
  const held = files.secrets.databases[name];
  if (held !== undefined && held.url !== url) {
    throw new CliUsage(DbText.enum.taken);
  }
  await pgAccess.run(url, DbToken.enum.selectOne);
  await writeServerFiles(ctx.env.projectDir, {
    config: files.config,
    secrets: {
      ...files.secrets,
      databases: {
        ...files.secrets.databases,
        [name]: { url, origin: held?.origin ?? DatabaseOrigin.enum.use },
      },
      attached: url,
    },
  });
  io.stdout(`using ${name}\n`);
  return EXIT_OK;
}

export async function runDbDelete(
  ctx: CliContext,
  args: { readonly name: string; readonly yes: boolean },
  io: Io,
  pgAccess: PgAccess = livePg,
): Promise<number> {
  const files = await requireDeskProject(ctx.env.projectDir);
  const entry = entryOf(files, args.name);
  const confirmed =
    args.yes ||
    (await ctx.env.prompter.confirm({
      message: DbText.enum.confirmDelete,
      flag: DbText.enum.yesOption,
    }));
  if (!confirmed) return EXIT_OK;
  if (entry.origin === DatabaseOrigin.enum.create) {
    await pgAccess.run(
      superuserUrl(ctx.env.vars),
      `DROP DATABASE ${quoteIdentifier(args.name)}`,
    );
  }
  const rest = Object.fromEntries(
    Object.entries(files.secrets.databases).filter(
      ([name]) => name !== args.name,
    ),
  );
  const { attached, ...secrets } = files.secrets;
  await writeServerFiles(ctx.env.projectDir, {
    config: files.config,
    secrets: {
      ...secrets,
      databases: rest,
      ...(attached === entry.url ? {} : { attached }),
    },
  });
  io.stdout(
    entry.origin === DatabaseOrigin.enum.create
      ? `deleted ${args.name}\n`
      : `detached ${args.name}\n`,
  );
  return EXIT_OK;
}

export function registerDb(program: Command, ctx: CliContext): void {
  const db = program
    .command(DbCommand.enum.db)
    .description(DbText.enum.description);
  const { io } = ctx.env;
  db.command(DbCommand.enum.create)
    .description(DbText.enum.createDescription)
    .option(DbText.enum.nameFlag, DbText.enum.nameDescription)
    .action(async (opts: { name?: string }) => {
      await runDbCreate(ctx, opts, io);
    });
  db.command(DbCommand.enum.list)
    .description(DbText.enum.listDescription)
    .action(async () => {
      await runDbList(ctx, io);
    });
  db.command(DbCommand.enum.show)
    .description(DbText.enum.showDescription)
    .argument(DbText.enum.nameArgument)
    .option(DbText.enum.showSecretsFlag, DbText.enum.showSecretsDescription)
    .action(async (name: string, opts: { showSecrets?: boolean }) => {
      await runDbShow(
        ctx,
        { name, showSecrets: opts.showSecrets === true },
        io,
      );
    });
  db.command(DbCommand.enum.use)
    .description(DbText.enum.useDescription)
    .action(async () => {
      await runDbUse(ctx, io);
    });
  db.command(DbCommand.enum.delete)
    .description(DbText.enum.deleteDescription)
    .argument(DbText.enum.nameArgument)
    .action(async (name: string, _opts: unknown, command: Command) => {
      const yes = command.optsWithGlobals()[DbText.enum.yesOption] === true;
      await runDbDelete(ctx, { name, yes }, io);
    });
}
