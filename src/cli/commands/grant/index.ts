import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import { runGrantAdd, runGrantRemove } from './grant.ts';
import type { GrantArgs } from './grant.ts';

export const GrantCommand = z.enum({
  grant: 'grant',
  add: 'add',
  remove: 'remove',
});

const GrantFlag = z.enum({
  org: '--org <org>',
  sub: '--sub <sub>',
  tool: '--tool <key...>',
});

const GrantHelp = z.enum({
  addDescription: 'give a builder tool:assign on each --tool',
  removeDescription: 'take tool:assign on each --tool from a builder',
  org: 'organization id',
  sub: 'the builder sub, in your own namespace',
  tool: 'tool key; repeat for more',
  subFlag: 'sub',
  subPrompt: 'Builder sub',
  toolFlag: 'tool',
  toolPrompt: 'Tool key',
});

interface GrantOptions {
  readonly org?: string;
  readonly sub?: string;
  readonly tool?: readonly string[];
}

/** A missing `--sub` or `--tool` is a prompt; with no TTY it is `missing --<flag>` (PD3). */
async function grantArgs(
  ctx: CliContext,
  options: GrantOptions,
): Promise<GrantArgs> {
  const { prompter } = ctx.env;
  const sub =
    options.sub ??
    (await prompter.text({
      message: GrantHelp.enum.subPrompt,
      flag: GrantHelp.enum.subFlag,
    }));
  const tools = options.tool ?? [
    await prompter.text({
      message: GrantHelp.enum.toolPrompt,
      flag: GrantHelp.enum.toolFlag,
    }),
  ];
  return options.org === undefined
    ? { sub, tools }
    : { org: options.org, sub, tools };
}

function grantCommand(
  parent: Command,
  verb: string,
  description: string,
  run: (args: GrantArgs) => Promise<number>,
  ctx: CliContext,
): void {
  parent
    .command(verb)
    .description(description)
    .option(GrantFlag.enum.org, GrantHelp.enum.org)
    .option(GrantFlag.enum.sub, GrantHelp.enum.sub)
    .option(GrantFlag.enum.tool, GrantHelp.enum.tool)
    .action(async (options: GrantOptions) => {
      await run(await grantArgs(ctx, options));
    });
}

/** `grant add` and `grant remove`; `grant list` stays a table leaf (PD2). */
export function registerGrant(program: Command, ctx: CliContext): void {
  const grant = program.command(GrantCommand.enum.grant);
  grantCommand(
    grant,
    GrantCommand.enum.add,
    GrantHelp.enum.addDescription,
    (args) => runGrantAdd(ctx, args),
    ctx,
  );
  grantCommand(
    grant,
    GrantCommand.enum.remove,
    GrantHelp.enum.removeDescription,
    (args) => runGrantRemove(ctx, args),
    ctx,
  );
}
