import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import type { Credentials } from '../../utils/credentials.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';

const Page = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

async function signedIn(ctx: CliContext): Promise<Credentials> {
  const file = await ctx.credentials.read();
  if (file === undefined) throw new CliFailure('run cli login');
  return file;
}

/** A page size has no default in the API, so it is a flag or a prompt like any required input. */
async function pageLimit(
  ctx: CliContext,
  given: string | undefined,
): Promise<number> {
  const text =
    given ??
    (await ctx.env.prompter.text({ message: 'Page size', flag: 'limit' }));
  const limit = Number(text);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new CliUsage('invalid --limit');
  }
  return limit;
}

/** Lists with `operationId`, then asks which row to switch to. */
async function pick(
  ctx: CliContext,
  operationId: string,
  input: Record<string, unknown>,
  question: { readonly message: string; readonly flag: string },
): Promise<string> {
  const result = await ctx.call(operationId, input);
  if (!result.ok) {
    throw new CliFailure(`${operationId} failed: ${result.error.type}`);
  }
  const rows = Page.parse(result.value).items;
  return ctx.env.prompter.select({
    ...question,
    options: rows.map((row) => ({ value: row.id, label: row.name })),
  });
}

/** A new org drops the old space: a space belongs to one org. */
async function switchOrg(
  ctx: CliContext,
  options: { readonly limit?: string },
): Promise<void> {
  const file = await signedIn(ctx);
  const limit = await pageLimit(ctx, options.limit);
  const org = await pick(
    ctx,
    'listOrgs',
    { limit },
    { message: 'Organization', flag: 'org' },
  );
  await ctx.credentials.write({ baseUrl: file.baseUrl, auth: file.auth, org });
  ctx.env.io.stdout(`org: ${org}\n`);
}

async function switchSpace(
  ctx: CliContext,
  options: { readonly org?: string; readonly limit?: string },
): Promise<void> {
  const file = await signedIn(ctx);
  const org =
    options.org ??
    file.org ??
    (await ctx.env.prompter.text({ message: 'Organization id', flag: 'org' }));
  const limit = await pageLimit(ctx, options.limit);
  const space = await pick(
    ctx,
    'listSpaces',
    { org, limit },
    { message: 'Space', flag: 'space' },
  );
  await ctx.credentials.write({ ...file, org, space });
  ctx.env.io.stdout(`space: ${space}\n`);
}

/** The group command for `name`; the leaf table reuses it for `list` (PD2). */
function group(program: Command, name: string): Command {
  return (
    program.commands.find((command) => command.name() === name) ??
    program.command(name)
  );
}

export function registerContext(program: Command, ctx: CliContext): void {
  group(program, 'orgs')
    .command('switch')
    .description('set the current organization')
    .option('--limit <n>', 'page size for the list')
    .action(async (options: { readonly limit?: string }) => {
      await switchOrg(ctx, options);
    });
  group(program, 'space')
    .command('switch')
    .description('set the current space')
    .option('--org <org>', 'organization id')
    .option('--limit <n>', 'page size for the list')
    .action(
      async (options: { readonly org?: string; readonly limit?: string }) => {
        await switchSpace(ctx, options);
      },
    );
}
