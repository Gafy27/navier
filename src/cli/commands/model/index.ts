import type { Command } from 'commander';
import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import { EXIT_OK } from '../../utils/constants.ts';
import { usageMissingFlag } from '../../utils/copy.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { OP } from '../../utils/leaf.ts';
import { apiFailure, orgOf } from '../grant/grant.ts';

export const ModelCommand = z.enum({ model: 'model', enable: 'enable' });

const ModelFlag = z.enum({
  org: '--org <org>',
  provider: '--provider <provider>',
  model: '--model <model...>',
  models: '--models <list>',
});

export const ModelText = z.enum({
  description: 'enable models: a multiselect, or --provider with --model',
  org: 'organization id',
  provider: 'provider id',
  model: 'model id; repeat for more',
  models: 'comma-separated model ids',
  providerFlag: 'provider',
  modelFlag: 'model',
  pickPrompt: 'Models to enable',
  listSep: ',',
  refSep: '/',
  noDisabled: 'every model is already enabled',
  unknownModel: 'unknown model: ',
  unexpectedList: 'unexpected list response',
  enabled: 'enabled',
  lineSep: ': ',
  newline: '\n',
});

const ModelRow = z.object({
  provider: z.string(),
  model: z.string(),
  enabled: z.boolean(),
});
type ModelRow = z.infer<typeof ModelRow>;
const ModelPage = z.object({ items: z.array(ModelRow) });

export interface ModelEnableArgs {
  readonly org?: string;
  readonly provider?: string;
  readonly model?: readonly string[];
}

/** `provider/model`, the same reference `chat --model` takes (PD14). */
function refOf(row: {
  readonly provider: string;
  readonly model: string;
}): string {
  return `${row.provider}${ModelText.enum.refSep}${row.model}`;
}

async function listModels(ctx: CliContext, org: string): Promise<ModelRow[]> {
  const result = await ctx.call(OP.listModels, { org });
  if (!result.ok) throw apiFailure(result.error);
  const page = ModelPage.safeParse(result.value);
  if (!page.success) throw new CliFailure(ModelText.enum.unexpectedList);
  return page.data.items;
}

/** Flag ids name models of one provider. Any id not in the list is refused before a write. */
function flagged(
  rows: readonly ModelRow[],
  provider: string,
  ids: readonly string[],
): ModelRow[] {
  return ids.map((model) => {
    const row = rows.find((r) => r.provider === provider && r.model === model);
    if (row === undefined) {
      throw new CliUsage(
        `${ModelText.enum.unknownModel}${refOf({ provider, model })}`,
      );
    }
    return row;
  });
}

/** A multiselect over the models with `enabled: false`, narrowed to `--provider` when given. */
async function picked(
  ctx: CliContext,
  rows: readonly ModelRow[],
  provider: string | undefined,
): Promise<ModelRow[]> {
  const disabled = rows.filter(
    (row) =>
      !row.enabled && (provider === undefined || row.provider === provider),
  );
  if (disabled.length === 0) return [];
  const refs = await ctx.env.prompter.multiselect({
    message: ModelText.enum.pickPrompt,
    flag: ModelText.enum.modelFlag,
    options: disabled.map((row) => ({ value: refOf(row), label: refOf(row) })),
  });
  return disabled.filter((row) => refs.includes(refOf(row)));
}

/** `model enable`: one `setModelPolicy { enabled: true, degraded: false }` per pick (G7, PD14). */
export async function runModelEnable(
  ctx: CliContext,
  args: ModelEnableArgs,
): Promise<number> {
  const ids = args.model ?? [];
  if (!ctx.env.io.isTTY) {
    if (args.provider === undefined) {
      throw new CliUsage(usageMissingFlag(ModelText.enum.providerFlag));
    }
    if (ids.length === 0) {
      throw new CliUsage(usageMissingFlag(ModelText.enum.modelFlag));
    }
  }
  const org = await orgOf(ctx, args.org);
  const rows = await listModels(ctx, org);
  const picks =
    args.provider !== undefined && ids.length > 0
      ? flagged(rows, args.provider, ids)
      : await picked(ctx, rows, args.provider);
  if (picks.length === 0) {
    ctx.env.io.stdout(`${ModelText.enum.noDisabled}${ModelText.enum.newline}`);
    return EXIT_OK;
  }
  for (const row of picks) {
    const set = await ctx.call(OP.setModelPolicy, {
      org,
      provider: row.provider,
      model: row.model,
      body: { enabled: true, degraded: false },
    });
    if (!set.ok) throw apiFailure(set.error);
    ctx.env.io.stdout(
      `${refOf(row)}${ModelText.enum.lineSep}${ModelText.enum.enabled}${ModelText.enum.newline}`,
    );
  }
  return EXIT_OK;
}

interface ModelOptions {
  readonly org?: string;
  readonly provider?: string;
  readonly model?: readonly string[];
  readonly models?: string;
}

/** `--model` repeats and `--models a,b` splits; both name models of `--provider`. */
function modelIds(options: ModelOptions): readonly string[] {
  const listed =
    options.models === undefined
      ? []
      : options.models
          .split(ModelText.enum.listSep)
          .map((id) => id.trim())
          .filter((id) => id.length > 0);
  return [...(options.model ?? []), ...listed];
}

/** `model enable` only; `model list`, `disable`, and `degrade` stay table leaves (PD2, PD14). */
export function registerModel(program: Command, ctx: CliContext): void {
  program
    .command(ModelCommand.enum.model)
    .command(ModelCommand.enum.enable)
    .description(ModelText.enum.description)
    .option(ModelFlag.enum.org, ModelText.enum.org)
    .option(ModelFlag.enum.provider, ModelText.enum.provider)
    .option(ModelFlag.enum.model, ModelText.enum.model)
    .option(ModelFlag.enum.models, ModelText.enum.models)
    .action(async (options: ModelOptions) => {
      const { org, provider } = options;
      await runModelEnable(ctx, {
        ...(org === undefined ? {} : { org }),
        ...(provider === undefined ? {} : { provider }),
        model: modelIds(options),
      });
    });
}
