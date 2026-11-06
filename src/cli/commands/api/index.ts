import type { Command } from 'commander';
import { listCatalogOperations } from '../../../client/index.ts';
import type { CliContext } from '../../utils/context.ts';
import { CliUsage } from '../../utils/failure.ts';
import type { Input } from '../../utils/leaf.ts';
import {
  catalogOperation,
  checkInput,
  emitFrames,
  isInput,
  printResult,
  secretIn,
  secretRefused,
} from '../../utils/leaf.ts';

const COMMAND = 'api';
const OPERATION_ARG = '[operationId]';
const JSON_ARG = '[json]';
const STREAM_FLAG = '--stream';
const LIST_FLAG = '--list';
const NEWLINE = '\n';

const HELP = {
  command: 'call one catalog operation by id, with an optional JSON input',
  stream: 'print each stream frame as one JSON line',
  list: 'print the sorted catalog operation ids',
} as const;

const MESSAGE = {
  noOperation: 'missing operation id',
  unknownOperation: 'unknown operation',
  notJson: 'argument is not JSON',
  notObject: 'argument is not a JSON object',
} as const;

interface ApiOptions {
  readonly stream?: boolean;
  readonly list?: boolean;
}

/** The positional argument is the whole input object, or nothing. */
function parseJson(text: string | undefined): Input {
  if (text === undefined) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CliUsage(MESSAGE.notJson);
  }
  if (!isInput(parsed)) throw new CliUsage(MESSAGE.notObject);
  return parsed;
}

function catalogIds(): string[] {
  return listCatalogOperations()
    .map((op) => op.operationId)
    .sort();
}

async function runApi(
  ctx: CliContext,
  operationId: string | undefined,
  json: string | undefined,
  options: ApiOptions,
): Promise<void> {
  if (options.list === true) {
    ctx.env.io.stdout(`${catalogIds().join(NEWLINE)}${NEWLINE}`);
    return;
  }
  if (operationId === undefined) throw new CliUsage(MESSAGE.noOperation);
  const op = catalogOperation(operationId);
  if (op === undefined) throw new CliUsage(MESSAGE.unknownOperation);
  const input = parseJson(json);
  const secret = secretIn(op.operationId, input);
  if (secret !== undefined) throw new CliUsage(secretRefused(secret));
  const checked = checkInput(op, input);
  if (!checked.ok) throw checked.error;
  if (options.stream === true) {
    const frames = await ctx.streamCall(op.operationId, checked.value);
    await emitFrames(frames, ctx.env.io);
    return;
  }
  printResult(await ctx.call(op.operationId, checked.value), ctx.env.io);
}

/** The raw escape hatch: any catalog operation by id (D1). */
export function registerApi(program: Command, ctx: CliContext): void {
  program
    .command(COMMAND)
    .description(HELP.command)
    .argument(OPERATION_ARG)
    .argument(JSON_ARG)
    .option(STREAM_FLAG, HELP.stream)
    .option(LIST_FLAG, HELP.list)
    .action(
      async (
        operationId: string | undefined,
        json: string | undefined,
        options: ApiOptions,
      ) => {
        await runApi(ctx, operationId, json, options);
      },
    );
}
