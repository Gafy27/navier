import type { StreamEvent } from '../../../client/index.ts';
import { z } from '../../../index.ts';
import type { CliOut } from '../../utils/failure.ts';
import { CliFailure } from '../../utils/failure.ts';

/** The most characters one `tool` line prints (architecture D5). */
export const CHAT_TOOL_INPUT_PREVIEW_MAX = 120;
/** Exit code of `chat --message` when the turn pauses on a person (D12). */
export const CHAT_BLOCKED_EXIT = 3;

export type BlockedFrame = Extract<StreamEvent, { kind: 'blocked' }>;

/** Tool key and arguments per `actionId`, filled by `action` frames (D5, Q2=A). */
export type ChatActionState = Map<
  string,
  { readonly toolKey: string; readonly arguments: unknown }
>;

export type Rendered =
  | 'continue'
  | { readonly blocked: BlockedFrame }
  | { readonly terminal: string };

const RenderText = z.enum({
  dimOn: '\u001B[2m',
  dimOff: '\u001B[22m',
  toolWord: 'tool',
  errorWord: 'error',
  space: ' ',
  ellipsis: '…',
  newline: '\n',
  badData: 'unexpected frame data',
  toolBeforeAction: 'tool frame before its action',
});

const ActionData = z.object({
  actionId: z.string(),
  toolKey: z.string(),
  arguments: z.json(),
});
const ToolData = z.object({ actionId: z.string(), isError: z.boolean() });

function dataOf<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new CliFailure(RenderText.enum.badData);
  return parsed.data;
}

/** One line, never longer than `CHAT_TOOL_INPUT_PREVIEW_MAX` (D5). */
function toolLine(
  entry: { readonly toolKey: string; readonly arguments: unknown },
  isError: boolean,
): string {
  const parts = [
    RenderText.enum.toolWord,
    entry.toolKey,
    JSON.stringify(entry.arguments),
    ...(isError ? [RenderText.enum.errorWord] : []),
  ];
  const line = parts.join(RenderText.enum.space);
  return line.length > CHAT_TOOL_INPUT_PREVIEW_MAX
    ? `${line.slice(0, CHAT_TOOL_INPUT_PREVIEW_MAX - 1)}${RenderText.enum.ellipsis}`
    : line;
}

/**
 * Prints one frame. `action` frames fill `actionState`; a `tool` frame prints
 * from it and fails when its `action` never came (D5). `blocked` and `terminal`
 * go back to the caller, which prompts or ends (D12).
 */
export function renderFrame(
  frame: StreamEvent,
  out: CliOut,
  actionState: ChatActionState,
): Rendered {
  switch (frame.kind) {
    case 'delta':
      out.stdout(
        frame.delta === 'reasoning'
          ? `${RenderText.enum.dimOn}${frame.text}${RenderText.enum.dimOff}`
          : frame.text,
      );
      return 'continue';
    case 'action': {
      const { actionId, ...entry } = dataOf(ActionData, frame.data);
      actionState.set(actionId, entry);
      return 'continue';
    }
    case 'tool': {
      const tool = dataOf(ToolData, frame.data);
      const entry = actionState.get(tool.actionId);
      if (entry === undefined) {
        throw new CliFailure(RenderText.enum.toolBeforeAction);
      }
      // Text deltas carry no newline, so the line starts on a fresh one.
      out.stdout(
        `${RenderText.enum.newline}${toolLine(entry, tool.isError)}${RenderText.enum.newline}`,
      );
      return 'continue';
    }
    case 'blocked':
      return { blocked: frame };
    case 'terminal':
      return { terminal: frame.status };
    case 'step':
    case 'end-of-stream':
    case 'rollover':
      return 'continue';
  }
}
