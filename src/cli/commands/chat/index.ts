import { randomUUID } from 'node:crypto';
import type { Command } from 'commander';
import type { StreamEvent } from '../../../client/index.ts';
import { z } from '../../../index.ts';
import type { CliContext, Io } from '../../utils/context.ts';
import {
  EXIT_FAIL,
  EXIT_OK,
  STREAM_FAILURE_NAME,
} from '../../utils/constants.ts';
import { PROMPT_CANCELLED } from '../../utils/copy.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { OP } from '../../utils/leaf.ts';
import { apiFailure, orgOf } from '../grant/grant.ts';
import { CHAT_BLOCKED_EXIT, renderFrame } from './render.ts';
import type { BlockedFrame, ChatActionState } from './render.ts';

export const ChatText = z.enum({
  command: 'chat',
  description: 'talk to an agent: a REPL, or one turn with --message',
  agentArg: '[agent]',
  modelFlag: '--model <provider/model>',
  messageFlag: '--message <text>',
  modelHelp: 'model for the turn, as provider/model',
  messageHelp: 'run one turn and print every frame as a JSON line',
  agentFlagName: 'agent',
  spaceFlagName: 'space',
  messageFlagName: 'message',
  decisionFlagName: 'decision',
  rememberFlagName: 'remember',
  agentPrompt: 'Agent id',
  spacePrompt: 'Space id',
  messagePrompt: 'You',
  rememberPrompt: 'Remember this choice?',
  approve: 'approve',
  deny: 'deny',
  refSep: '/',
  lineSep: ': ',
  space: ' ',
  newline: '\n',
  statusPrefix: 'status: ',
  pending: 'unavailable: pending',
  badModel: 'model must be provider/model: ',
  modelNotEnabled: 'model is not enabled: ',
  unexpected: 'unexpected response',
  chatFailed: 'chat did not finish',
});
const Decision = z.enum({ approve: 'approve', deny: 'deny' });

/** `stopMessages` kind sent by the first Ctrl-C (D13). */
const STOP_KIND = 'cancel';

export interface ChatArgs {
  readonly agent?: string;
  readonly model?: string;
  readonly message?: string;
}

const Started = z.object({
  conversationId: z.string(),
  message: z.object({ agentMessageId: z.string().nullable() }).optional(),
});
const Posted = z.object({ agentMessageId: z.string().nullable() });
const ModelPage = z.object({
  items: z.array(
    z.object({ provider: z.string(), model: z.string(), enabled: z.boolean() }),
  ),
});

interface ModelSelection {
  readonly provider: string;
  readonly model: string;
  readonly reasoningEffort: null;
}

interface Session {
  readonly ctx: CliContext;
  readonly org: string;
  readonly space: string;
  readonly agent: string;
  readonly selection: ModelSelection | undefined;
  conv: string | undefined;
}

const ABANDONED = Symbol('abandoned');

/** A pending `postMessage`/`startConversation` reply that names no agent message. */
function agentMessageOf(value: unknown, shape: typeof Posted): string {
  const parsed = shape.safeParse(value);
  if (!parsed.success) throw new CliFailure(ChatText.enum.unexpected);
  if (parsed.data.agentMessageId === null) {
    throw new CliFailure(ChatText.enum.pending);
  }
  return parsed.data.agentMessageId;
}

/** `provider/model` must name an enabled policy before any post (PD14). */
async function selectionOf(
  ctx: CliContext,
  org: string,
  ref: string,
): Promise<ModelSelection> {
  const cut = ref.indexOf(ChatText.enum.refSep);
  if (cut <= 0 || cut === ref.length - 1) {
    throw new CliUsage(`${ChatText.enum.badModel}${ref}`);
  }
  const provider = ref.slice(0, cut);
  const model = ref.slice(cut + 1);
  const listed = await ctx.call(OP.listModels, { org });
  if (!listed.ok) throw apiFailure(listed.error);
  const page = ModelPage.safeParse(listed.value);
  if (!page.success) throw new CliFailure(ChatText.enum.unexpected);
  const found = page.data.items.some(
    (row) => row.enabled && row.provider === provider && row.model === model,
  );
  if (!found) throw new CliUsage(`${ChatText.enum.modelNotEnabled}${ref}`);
  return { provider, model, reasoningEffort: null };
}

/** Posts one user message; the first one starts the conversation. Returns the agent message id. */
async function post(session: Session, text: string): Promise<string> {
  const { ctx, org } = session;
  const message = {
    userMessageId: randomUUID(),
    agentMessageId: randomUUID(),
    agentId: session.agent,
    text,
    ...(session.selection === undefined
      ? {}
      : { modelSelection: session.selection }),
  };
  if (session.conv !== undefined) {
    const posted = await ctx.call(OP.postMessage, {
      org,
      conv: session.conv,
      body: message,
    });
    if (!posted.ok) throw apiFailure(posted.error);
    return agentMessageOf(posted.value, Posted);
  }
  const started = await ctx.call(OP.startConversation, {
    org,
    body: { spaceId: session.space, firstMessage: message },
  });
  if (!started.ok) throw apiFailure(started.error);
  const parsed = Started.safeParse(started.value);
  if (!parsed.success) throw new CliFailure(ChatText.enum.unexpected);
  session.conv = parsed.data.conversationId;
  return agentMessageOf(
    parsed.data.message ?? { agentMessageId: null },
    Posted,
  );
}

/** First Ctrl-C asks for a stop; the second gives up without waiting on it (D13). */
function watchInterrupt(stop: () => void): {
  readonly abandoned: Promise<typeof ABANDONED>;
  readonly release: () => void;
} {
  let presses = 0;
  let abandon: (value: typeof ABANDONED) => void = () => undefined;
  const abandoned = new Promise<typeof ABANDONED>((resolve) => {
    abandon = resolve;
  });
  const onSignal = (): void => {
    presses += 1;
    if (presses === 1) stop();
    else abandon(ABANDONED);
  };
  process.on('SIGINT', onSignal);
  return {
    abandoned,
    release: () => {
      process.off('SIGINT', onSignal);
    },
  };
}

/** `StreamFailure` is not on the client entry, so match its name and `type`. */
function streamFailure(cause: unknown): CliFailure | undefined {
  if (!(cause instanceof Error) || cause.name !== STREAM_FAILURE_NAME) {
    return undefined;
  }
  if (!('type' in cause) || typeof cause.type !== 'string') return undefined;
  return apiFailure({ type: cause.type, message: cause.message });
}

/** Prompts approve or deny for each blocked action of the frame, in frame order. */
async function answerBlocked(
  session: Session,
  frame: BlockedFrame,
  actionState: ChatActionState,
): Promise<void> {
  const { ctx, org } = session;
  const conv = session.conv ?? '';
  const { prompter } = ctx.env;
  for (const action of frame.actions) {
    const tool = actionState.get(action.actionId)?.toolKey ?? action.actionId;
    const choice = await prompter.select({
      message: `${action.kind}${ChatText.enum.lineSep}${tool}`,
      flag: ChatText.enum.decisionFlagName,
      options: [
        { value: Decision.enum.approve, label: ChatText.enum.approve },
        { value: Decision.enum.deny, label: ChatText.enum.deny },
      ],
    });
    const answered =
      choice === Decision.enum.deny
        ? await ctx.call(OP.denyBlockedAction, {
            org,
            conv,
            action: action.actionId,
          })
        : await ctx.call(OP.approveBlockedAction, {
            org,
            conv,
            action: action.actionId,
            body: action.canRemember
              ? {
                  remember: await prompter.confirm({
                    message: ChatText.enum.rememberPrompt,
                    flag: ChatText.enum.rememberFlagName,
                  }),
                }
              : {},
          });
    if (!answered.ok) throw apiFailure(answered.error);
  }
}

interface TurnEnd {
  readonly code: number;
  readonly abandoned: boolean;
}

/** Reads one agent message to its end. `json` prints every frame as a line and exits on a block (D12). */
async function readTurn(
  session: Session,
  msg: string,
  json: boolean,
  io: Io,
): Promise<TurnEnd> {
  const { ctx, org } = session;
  const conv = session.conv ?? '';
  const interrupt = watchInterrupt(() => {
    ctx
      .call(OP.stopMessages, {
        org,
        conv,
        body: { messageIds: [msg], kind: STOP_KIND },
      })
      .catch(() => undefined);
  });
  const actionState: ChatActionState = new Map();
  let status: string | undefined;
  let iterator: AsyncIterator<StreamEvent> | undefined;
  try {
    const frames = await ctx.streamCall(OP.message, { org, conv, msg });
    iterator = frames[Symbol.asyncIterator]();
    for (;;) {
      const next = await Promise.race([iterator.next(), interrupt.abandoned]);
      if (next === ABANDONED) return { code: EXIT_FAIL, abandoned: true };
      if (next.done === true || next.value.kind === 'end-of-stream') break;
      const frame = next.value;
      if (json) {
        io.stdout(`${JSON.stringify(frame)}${ChatText.enum.newline}`);
        if (frame.kind === 'blocked') {
          return { code: CHAT_BLOCKED_EXIT, abandoned: false };
        }
        if (frame.kind === 'terminal') status = frame.status;
        continue;
      }
      const rendered = renderFrame(frame, io, actionState);
      if (rendered === 'continue') continue;
      if ('terminal' in rendered) {
        status = rendered.terminal;
        continue;
      }
      const answered = await Promise.race([
        answerBlocked(session, rendered.blocked, actionState),
        interrupt.abandoned,
      ]);
      if (answered === ABANDONED) return { code: EXIT_FAIL, abandoned: true };
    }
  } catch (cause) {
    throw streamFailure(cause) ?? cause;
  } finally {
    interrupt.release();
    // Not awaited: a pending read must not hold the exit (D13).
    void iterator?.return?.();
  }
  if (status !== undefined && !json) {
    io.stderr(`${ChatText.enum.statusPrefix}${status}${ChatText.enum.newline}`);
  }
  return {
    code: status === 'succeeded' ? EXIT_OK : EXIT_FAIL,
    abandoned: false,
  };
}

/** The next REPL line; an empty line or a cancelled prompt ends the session. */
async function nextLine(ctx: CliContext): Promise<string> {
  try {
    return await ctx.env.prompter.text({
      message: ChatText.enum.messagePrompt,
      flag: ChatText.enum.messageFlagName,
    });
  } catch (cause) {
    if (cause instanceof CliFailure && cause.message === PROMPT_CANCELLED) {
      return '';
    }
    throw cause;
  }
}

/**
 * `chat`: a REPL in the context org and space, or one `--message` turn.
 * Only a `blocked` frame prompts; `chat` never lists blocked actions (B12).
 */
export async function runChat(
  ctx: CliContext,
  args: ChatArgs,
  io: Io,
): Promise<number> {
  const org = await orgOf(ctx, undefined);
  const { prompter } = ctx.env;
  const space =
    (await ctx.credentials.read())?.space ??
    (await prompter.text({
      message: ChatText.enum.spacePrompt,
      flag: ChatText.enum.spaceFlagName,
    }));
  const agent =
    args.agent ??
    (await prompter.text({
      message: ChatText.enum.agentPrompt,
      flag: ChatText.enum.agentFlagName,
    }));
  const selection =
    args.model === undefined
      ? undefined
      : await selectionOf(ctx, org, args.model);
  const session: Session = {
    ctx,
    org,
    space,
    agent,
    selection,
    conv: undefined,
  };
  if (args.message !== undefined) {
    const end = await readTurn(
      session,
      await post(session, args.message),
      true,
      io,
    );
    return end.code;
  }
  let code = EXIT_OK;
  for (
    let line = await nextLine(ctx);
    line.length > 0;
    line = await nextLine(ctx)
  ) {
    const end = await readTurn(session, await post(session, line), false, io);
    code = end.code;
    if (end.abandoned) break;
  }
  return code;
}

interface ChatOptions {
  readonly model?: string;
  readonly message?: string;
}

/**
 * `runCli` has no channel for a command's exit code yet, so a non-zero chat
 * end fails closed as a failure (exit 1) instead of exiting 0.
 */
export function registerChat(program: Command, ctx: CliContext): void {
  program
    .command(ChatText.enum.command)
    .description(ChatText.enum.description)
    .argument(ChatText.enum.agentArg)
    .option(ChatText.enum.modelFlag, ChatText.enum.modelHelp)
    .option(ChatText.enum.messageFlag, ChatText.enum.messageHelp)
    .action(async (agent: string | undefined, options: ChatOptions) => {
      const code = await runChat(
        ctx,
        {
          ...(agent === undefined ? {} : { agent }),
          ...(options.model === undefined ? {} : { model: options.model }),
          ...(options.message === undefined
            ? {}
            : { message: options.message }),
        },
        ctx.env.io,
      );
      if (code !== EXIT_OK) throw new CliFailure(ChatText.enum.chatFailed);
    });
}
