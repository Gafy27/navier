import { appError, err, ErrorCode, ok } from '../../src/index.ts';
import type { Authz } from '../../src/identity/index.ts';
import type { ModelAdapter, ModelResponse } from '../../src/llm/index.ts';
import type { FinishReason, ModelToolCall } from '../../src/llm/types.ts';
import type { ToolImplementation } from '../../src/runtime/index.ts';

/** What one scripted model call does (D4). */
export type ModelScript =
  /** Streams `chunks` (their concatenation is the text), then answers. */
  | {
      readonly kind: 'answer';
      readonly chunks: readonly string[];
      readonly toolCalls?: readonly ModelToolCall[];
      readonly finishReason?: FinishReason;
      /** Waits for `release()` after streaming, so a scenario can act while the model runs. */
      readonly hold?: boolean;
    }
  /** Streams `chunks`, then waits for the abort signal, as a stream a stop cuts. */
  | {
      readonly kind: 'stream_until_stopped';
      readonly chunks: readonly string[];
    }
  /** The provider refuses or fails: the call answers `err`. */
  | { readonly kind: 'fail' };

/** A scripted `ModelAdapter` (D4). It implements the unchanged interface and holds no key. */
export interface ScriptedModel extends ModelAdapter {
  /** Replaces the script. The next call reads its first entry. */
  load(script: readonly ModelScript[]): void;
  /** Resolves once `count` calls have started since the last `load`. */
  called(count: number): Promise<void>;
  /** Lets every call held by a `hold` entry answer. */
  release(): void;
  readonly calls: () => number;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const aborted = () => err(appError(ErrorCode.aborted, 'model call aborted'));

function waitForAbort(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else
      signal.addEventListener(
        'abort',
        () => {
          resolve();
        },
        { once: true },
      );
  });
}

/** A waiter list: `reached(n)` resolves when `bump` has been called `n` times. */
function counter(): {
  bump: () => void;
  reached: (n: number) => Promise<void>;
  reset: () => void;
  count: () => number;
} {
  let count = 0;
  let waiters: { n: number; done: () => void }[] = [];
  return {
    bump: () => {
      count += 1;
      for (const w of waiters) if (count >= w.n) w.done();
      waiters = waiters.filter((w) => count < w.n);
    },
    reached: (n) =>
      count >= n
        ? Promise.resolve()
        : new Promise((resolve) => waiters.push({ n, done: resolve })),
    reset: () => {
      count = 0;
      waiters = [];
    },
    count: () => count,
  };
}

export function scriptedModel(): ScriptedModel {
  let script: readonly ModelScript[] = [];
  let next = 0;
  const started = counter();
  let released = deferred();
  return {
    load: (entries) => {
      script = entries;
      next = 0;
      started.reset();
      released = deferred();
    },
    release: () => {
      released.resolve();
    },
    called: (count) => started.reached(count),
    calls: () => started.count(),
    generate: async (_request, _credentials, signal, onChunk) => {
      const entry = script[next];
      next += 1;
      started.bump();
      if (entry === undefined || entry.kind === 'fail') {
        return err(appError(ErrorCode.unavailable, 'model failed'));
      }
      for (const text of entry.chunks) {
        await onChunk?.({ kind: 'text', text });
      }
      if (entry.kind === 'stream_until_stopped') {
        await waitForAbort(signal);
        return aborted();
      }
      if (entry.hold === true) {
        await Promise.race([released.promise, waitForAbort(signal)]);
        if (signal.aborted) return aborted();
      }
      const toolCalls = entry.toolCalls ?? [];
      const response: ModelResponse = {
        text: entry.chunks.join(''),
        reasoning: [],
        toolCalls,
        finishReason:
          entry.finishReason ?? (toolCalls.length > 0 ? 'tool_calls' : 'stop'),
        usage: { inputTokens: 1, outputTokens: 1 },
        raw: [],
      };
      return ok(response);
    },
  };
}

/** The tool keys the fake agent holds. */
export const ToolKey = {
  echo: 'echo',
  gated: 'gated',
  hang: 'hang',
} as const;

export interface ScriptedTools {
  readonly implementations: readonly ToolImplementation[];
  /** Resolves once `count` `hang` calls have started. */
  hanging(count: number): Promise<void>;
  reset(): void;
}

/** Fake tools: `echo` returns its input, `gated` is the one the catalog marks `high`, `hang` waits for its abort. */
export function scriptedTools(): ScriptedTools {
  const hanging = counter();
  const implementations: ToolImplementation[] = [
    {
      key: ToolKey.echo,
      implementationVersion: 1,
      execute: (input) => Promise.resolve({ echo: input as never }),
    },
    {
      key: ToolKey.gated,
      implementationVersion: 1,
      execute: () => Promise.resolve({ done: true }),
    },
    {
      key: ToolKey.hang,
      implementationVersion: 1,
      execute: async (_input, ctx) => {
        hanging.bump();
        await waitForAbort(ctx.abortSignal);
        throw new Error('hang aborted');
      },
    },
  ];
  return {
    implementations,
    hanging: hanging.reached,
    reset: hanging.reset,
  };
}

/** An `Authz` that allows every question, so a scenario's rows depend on the runner and not on grants. */
export function allowAllAuthz(): Authz {
  const answers: Record<string, unknown> = {
    check: () => Promise.resolve(ok({ allow: true })),
    checkMany: (_org: unknown, _caller: unknown, scopes: readonly unknown[]) =>
      Promise.resolve(ok(scopes.map(() => ({ allow: true })))),
    checkAgentUse: (
      _caller: unknown,
      _org: unknown,
      queries: readonly unknown[],
    ) => Promise.resolve(ok(queries.map(() => ({ kind: 'direct' })))),
  };
  return new Proxy(answers, {
    get: (target, name: string) =>
      target[name] ?? (() => Promise.resolve(ok(undefined))),
  }) as unknown as Authz;
}
