import { ToolKey } from './fakes.ts';
import type { ModelScript } from './fakes.ts';

/** One action of a scenario, run in order after the first post (PD1). */
export type Action =
  /** Waits until the model has started `calls` calls. */
  | { readonly waitModel: number }
  /** Waits until `hang` has started `calls` calls. */
  | { readonly waitHang: number }
  /** Waits until an action of the first message is blocked on approval. */
  | { readonly waitBlocked: true }
  | { readonly stop: 'cancel' | 'interrupt' }
  | { readonly decide: 'approve' | 'deny' }
  /** Posts a second user message while the first turn runs. */
  | { readonly postWhileRunning: string }
  /** Lets a held model call answer. */
  | { readonly release: true }
  /** Waits until every agent message so far is terminal. */
  | { readonly settle: true }
  /** Edits the first user message into a new turn. */
  | { readonly edit: string }
  /** Retries the newest agent message. */
  | { readonly retry: true };

/** What one agent message must look like in the rows. Never a runner internal (D2). */
export interface MessageRows {
  /** Message statuses in order, `status` or `status:reason`. */
  readonly statuses: readonly string[];
  /** One entry per action, in call order: tool key and its statuses. */
  readonly actions: readonly {
    readonly tool: string;
    readonly statuses: readonly string[];
  }[];
  /** Model steps that wrote a row. */
  readonly steps: number;
  /** Stream deltas written. */
  readonly deltas: number;
}

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly tools: readonly string[];
  readonly maxSteps?: number;
  readonly model: readonly ModelScript[];
  readonly actions: readonly Action[];
  /** The agent messages of the thread, in rank order. */
  readonly rows: readonly MessageRows[];
}

const call = (id: string, name: string) => ({
  id,
  name,
  input: { n: 1 },
});

const say = (...chunks: string[]): ModelScript => ({ kind: 'answer', chunks });

const callTools = (hold: boolean, ...tools: string[]): ModelScript => ({
  kind: 'answer',
  chunks: ['calling'],
  toolCalls: tools.map((tool, i) => call(`c${String(i + 1)}`, tool)),
  hold,
});

const OK = ['succeeded'];

/** S1–S12 (D3). One array of data; the harness reads it (PD1). */
export const scenarios: readonly Scenario[] = [
  {
    id: 'S1',
    title: 'plain answer',
    tools: [],
    model: [say('hel', 'lo')],
    actions: [],
    rows: [
      { statuses: ['created', 'succeeded'], actions: [], steps: 1, deltas: 2 },
    ],
  },
  {
    id: 'S2',
    title: 'one tool call',
    tools: [ToolKey.echo],
    model: [callTools(false, ToolKey.echo), say('done')],
    actions: [],
    rows: [
      {
        statuses: ['created', 'succeeded'],
        actions: [
          { tool: ToolKey.echo, statuses: ['created', 'running', ...OK] },
        ],
        steps: 2,
        deltas: 2,
      },
    ],
  },
  {
    id: 'S3',
    title: 'two parallel tool calls',
    tools: [ToolKey.echo],
    model: [callTools(false, ToolKey.echo, ToolKey.echo), say('done')],
    actions: [],
    rows: [
      {
        statuses: ['created', 'succeeded'],
        actions: [
          { tool: ToolKey.echo, statuses: ['created', 'running', ...OK] },
          { tool: ToolKey.echo, statuses: ['created', 'running', ...OK] },
        ],
        steps: 2,
        deltas: 2,
      },
    ],
  },
  {
    id: 'S4',
    title: 'approval approved',
    tools: [ToolKey.gated],
    model: [callTools(false, ToolKey.gated), say('done')],
    actions: [{ waitBlocked: true }, { decide: 'approve' }],
    rows: [
      {
        statuses: [
          'created',
          'paused:approval',
          'created:resumed',
          'succeeded',
        ],
        actions: [
          {
            tool: ToolKey.gated,
            statuses: [
              'blocked:approval',
              'created:approved',
              'running',
              ...OK,
            ],
          },
        ],
        steps: 2,
        deltas: 2,
      },
    ],
  },
  {
    id: 'S5',
    title: 'approval denied',
    tools: [ToolKey.gated],
    model: [callTools(false, ToolKey.gated), say('done')],
    actions: [{ waitBlocked: true }, { decide: 'deny' }],
    rows: [
      {
        statuses: [
          'created',
          'paused:approval',
          'created:resumed',
          'succeeded',
        ],
        actions: [
          {
            tool: ToolKey.gated,
            statuses: ['blocked:approval', 'errored:denied'],
          },
        ],
        steps: 2,
        deltas: 2,
      },
    ],
  },
  {
    id: 'S6',
    title: 'approval expired',
    tools: [ToolKey.gated],
    model: [callTools(false, ToolKey.gated)],
    actions: [{ waitBlocked: true }],
    rows: [
      {
        statuses: ['created', 'paused:approval', 'expired:pause_timeout'],
        actions: [
          {
            tool: ToolKey.gated,
            statuses: ['blocked:approval', 'cancelled:turn_ended'],
          },
        ],
        steps: 1,
        deltas: 1,
      },
    ],
  },
  {
    id: 'S7',
    title: 'cancel during the model stream',
    tools: [],
    model: [{ kind: 'stream_until_stopped', chunks: ['par'] }],
    actions: [{ waitModel: 1 }, { stop: 'cancel' }],
    rows: [
      { statuses: ['created', 'cancelled'], actions: [], steps: 0, deltas: 1 },
    ],
  },
  {
    id: 'S8',
    title: 'interrupt during a tool call',
    tools: [ToolKey.hang],
    model: [callTools(false, ToolKey.hang)],
    actions: [{ waitHang: 1 }, { stop: 'interrupt' }],
    rows: [
      {
        statuses: ['created', 'interrupted'],
        actions: [
          {
            tool: ToolKey.hang,
            statuses: ['created', 'running', 'cancelled:turn_ended'],
          },
        ],
        steps: 1,
        deltas: 1,
      },
    ],
  },
  {
    id: 'S9',
    title: 'graceful stop by a pending message, then the promoted turn',
    tools: [ToolKey.echo],
    model: [callTools(true, ToolKey.echo), say('second')],
    actions: [
      { waitModel: 1 },
      { postWhileRunning: 'and then?' },
      { release: true },
    ],
    rows: [
      {
        statuses: ['created', 'gracefully_stopped'],
        actions: [
          { tool: ToolKey.echo, statuses: ['created', 'running', ...OK] },
        ],
        steps: 1,
        deltas: 1,
      },
      { statuses: ['created', 'succeeded'], actions: [], steps: 1, deltas: 1 },
    ],
  },
  {
    id: 'S10',
    title: 'model failed',
    tools: [],
    model: [{ kind: 'fail' }],
    actions: [],
    rows: [
      {
        statuses: ['created', 'errored:model_failed'],
        actions: [],
        steps: 0,
        deltas: 0,
      },
    ],
  },
  {
    id: 'S11',
    title: 'maxSteps reached',
    tools: [ToolKey.echo],
    maxSteps: 1,
    model: [callTools(false, ToolKey.echo), say('never')],
    actions: [],
    rows: [
      {
        statuses: ['created', 'max_steps'],
        actions: [
          { tool: ToolKey.echo, statuses: ['created', 'running', ...OK] },
        ],
        steps: 1,
        deltas: 1,
      },
    ],
  },
  {
    id: 'S12',
    title: 'edit and retry',
    tools: [],
    model: [say('one'), say('two'), say('three')],
    actions: [
      { settle: true },
      { edit: 'edited' },
      { settle: true },
      { retry: true },
    ],
    rows: [
      { statuses: ['created', 'succeeded'], actions: [], steps: 1, deltas: 1 },
      { statuses: ['created', 'succeeded'], actions: [], steps: 1, deltas: 1 },
      { statuses: ['created', 'succeeded'], actions: [], steps: 1, deltas: 1 },
    ],
  },
];
