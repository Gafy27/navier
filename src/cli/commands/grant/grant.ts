import { z } from '../../../index.ts';
import type { CliContext } from '../../utils/context.ts';
import { AuthKind } from '../../utils/credentials.ts';
import { ERROR_LINE_SEP, EXIT_OK } from '../../utils/constants.ts';
import { CliFailure } from '../../utils/failure.ts';
import { OP } from '../../utils/leaf.ts';
import { builderPrincipal, toolObject } from '../../utils/principal.ts';

/** The one privilege `grant add` and `grant remove` move (P13.8 D2). */
export const GrantPrivilege = z.enum({ assign: 'assign' });

/** The `writeGrants` list each command fills (P13.8 PD5). */
export const GrantChange = z.enum({ writes: 'writes', deletes: 'deletes' });
type GrantChange = z.infer<typeof GrantChange>;

export const GrantText = z.enum({
  orgFlag: 'org',
  orgPrompt: 'Organization id',
  tool: 'tool',
  lineSep: ': ',
  granted: 'granted',
  revoked: 'revoked',
  unexpectedMe: 'unexpected whoami response',
  newline: '\n',
});

const DONE_WORD: Readonly<Record<GrantChange, string>> = {
  [GrantChange.enum.writes]: GrantText.enum.granted,
  [GrantChange.enum.deletes]: GrantText.enum.revoked,
};

const Me = z.object({ principal: z.string(), kind: AuthKind });

export interface GrantArgs {
  readonly org?: string;
  readonly sub: string;
  readonly tools: readonly string[];
}

/** An API refusal as `<type>: <message>`; `runCli` prints it and exits 1. */
export function apiFailure(error: {
  readonly type: string;
  readonly message: string;
}): CliFailure {
  return new CliFailure(`${error.type}${ERROR_LINE_SEP}${error.message}`);
}

/** `--org`, then the credentials context, then a prompt (D2, D3). */
export async function orgOf(
  ctx: CliContext,
  given: string | undefined,
): Promise<string> {
  return (
    given ??
    (await ctx.credentials.read())?.org ??
    (await ctx.env.prompter.text({
      message: GrantText.enum.orgPrompt,
      flag: GrantText.enum.orgFlag,
    }))
  );
}

/** One `writeGrants` with one object per tool, all or none. A bad key or `sub` fails before any write. */
async function runGrantChange(
  ctx: CliContext,
  args: GrantArgs,
  change: GrantChange,
): Promise<number> {
  const org = await orgOf(ctx, args.org);
  const objects = args.tools.map((key) => {
    const object = toolObject(org, key);
    if (!object.ok) throw object.error;
    return object.value;
  });
  const me = await ctx.call(OP.me, {});
  if (!me.ok) throw apiFailure(me.error);
  const who = Me.safeParse(me.value);
  if (!who.success) throw new CliFailure(GrantText.enum.unexpectedMe);
  const principal = builderPrincipal(who.data, args.sub);
  if (!principal.ok) throw principal.error;
  const entry = {
    principal: principal.value,
    privilege: GrantPrivilege.enum.assign,
  };
  const written = await ctx.call(OP.writeGrants, {
    org,
    body: { objects: objects.map((object) => ({ object, [change]: [entry] })) },
  });
  if (!written.ok) throw apiFailure(written.error);
  for (const key of args.tools) {
    ctx.env.io.stdout(
      `${GrantText.enum.tool} ${key}${GrantText.enum.lineSep}${GrantPrivilege.enum.assign} ${DONE_WORD[change]}${GrantText.enum.newline}`,
    );
  }
  return EXIT_OK;
}

/** `grant add`: the builder `sub` gets `tool:assign` on each tool (P13.8 G3). */
export function runGrantAdd(ctx: CliContext, args: GrantArgs): Promise<number> {
  return runGrantChange(ctx, args, GrantChange.enum.writes);
}

/** `grant remove`: the same objects, as deletes. */
export function runGrantRemove(
  ctx: CliContext,
  args: GrantArgs,
): Promise<number> {
  return runGrantChange(ctx, args, GrantChange.enum.deletes);
}
