import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import { usageMissingFlag } from '../../utils/copy.ts';
import { CliUsage } from '../../utils/failure.ts';
import { OP, printResult } from '../../utils/leaf.ts';
import {
  requireDeskProject,
  workerToolsToken,
} from '../../utils/server-config.ts';
import {
  readDevState,
  readWorkerTools,
  workerSources,
} from '../deploy/worker-tools.ts';
import type { ToolEntry } from '../deploy/worker-tools.ts';
import { orgOf } from '../grant/grant.ts';

const ToolText = z.enum({
  tool: 'tool',
  create: 'create',
  toolFlag: '--tool <key>',
  toolHelp: 'key of the worker entry to create',
  description: 'add one entry a desk worker serves on /tools to the catalog',
  question: 'Tool to create',
  noWorkers: 'config.yaml names no tool worker',
  notServed: 'no worker serves tool ',
});

export interface ToolCreateArgs {
  readonly tool?: string | undefined;
  readonly yes: boolean;
}

/** `--tool`, else `--yes` with exactly one entry, else a select over every served entry (D2, PD3). */
async function chosenKey(
  ctx: CliContext,
  entries: readonly ToolEntry[],
  args: ToolCreateArgs,
): Promise<string> {
  if (args.tool !== undefined) return args.tool;
  if (args.yes) {
    const only = entries.length === 1 ? entries[0] : undefined;
    if (only === undefined) {
      throw new CliUsage(usageMissingFlag(ToolText.enum.tool));
    }
    return only.key;
  }
  return ctx.env.prompter.select({
    message: ToolText.enum.question,
    flag: ToolText.enum.tool,
    options: entries.map((entry) => ({ value: entry.key, label: entry.name })),
  });
}

async function pickEntry(
  ctx: CliContext,
  entries: readonly ToolEntry[],
  args: ToolCreateArgs,
): Promise<ToolEntry> {
  const key = await chosenKey(ctx, entries, args);
  const entry = entries.find((candidate) => candidate.key === key);
  if (entry === undefined) {
    throw new CliUsage(`${ToolText.enum.notServed}${key}`);
  }
  return entry;
}

/** `tool create`: desk gate, the workers' `/tools` lists, one pick, one `createTool` (P13.8, PD8). */
export async function runToolCreate(
  ctx: CliContext,
  args: ToolCreateArgs,
): Promise<void> {
  const { projectDir, fetch } = ctx.env;
  const files = await requireDeskProject(projectDir);
  const sources = workerSources(
    files.config.workers,
    await readDevState(projectDir),
  );
  if (sources.length === 0) throw new CliUsage(ToolText.enum.noWorkers);
  const token = workerToolsToken(files.secrets);
  const entries: ToolEntry[] = [];
  for (const source of sources) {
    entries.push(...(await readWorkerTools(fetch, source, token)).entries);
  }
  const entry = await pickEntry(ctx, entries, args);
  const org = await orgOf(ctx, undefined);
  printResult(await ctx.call(OP.createTool, { org, body: entry }), ctx.env.io);
}

/** Adds `tool create`. Runs before `registerResources`, which adds the table's `tool` leaves to this group. */
export function registerTool(program: Command, ctx: CliContext): void {
  program
    .command(ToolText.enum.tool)
    .command(ToolText.enum.create)
    .description(ToolText.enum.description)
    .option(ToolText.enum.toolFlag, ToolText.enum.toolHelp)
    .action(async (options: { tool?: string }, command: Command) => {
      await runToolCreate(ctx, {
        tool: options.tool,
        yes: command.optsWithGlobals()['yes'] === true,
      });
    });
}
