import { appError, err, ErrorCode } from '../index.ts';
import {
  createAnthropicGenerate,
  verifyAnthropicKey,
} from './providers/anthropic.ts';
import {
  createOpenRouterGenerate,
  verifyOpenRouterKey,
} from './providers/openrouter.ts';
import type { Result } from '../index.ts';
import type {
  ModelAdapter,
  ModelChunk,
  ModelCredentials,
  ModelRequest,
  ModelResponse,
} from './types.ts';

type AdapterImpl = {
  readonly createGenerate: (
    credentials: ModelCredentials,
  ) => (
    request: ModelRequest,
    signal: AbortSignal,
    onChunk?: (chunk: ModelChunk) => void | Promise<void>,
  ) => Promise<Result<ModelResponse>>;
  readonly verifyKey: (
    credentials: ModelCredentials,
    signal: AbortSignal,
  ) => Promise<Result<void>>;
};

/** The closed set of adapters. A new provider is a new entry here. */
const ADAPTERS: Readonly<Record<string, AdapterImpl>> = {
  anthropic: {
    createGenerate: createAnthropicGenerate,
    verifyKey: verifyAnthropicKey,
  },
  openrouter: {
    createGenerate: createOpenRouterGenerate,
    verifyKey: verifyOpenRouterKey,
  },
};

/** The adapter names a provider row may name. */
export const ADAPTER_NAMES: readonly string[] = Object.keys(ADAPTERS);

const unknownAdapter = () =>
  err(appError(ErrorCode.invalid_argument, 'adapter: unknown'));

const adapterOf = (name: string) => ADAPTERS[name];

/** Builds the call from `credentials` and drops them when it returns. No I/O besides the HTTP call. */
export const modelAdapter: ModelAdapter = {
  generate(request, credentials, signal, onChunk) {
    const adapter = adapterOf(credentials.adapter);
    if (adapter === undefined) return Promise.resolve(unknownAdapter());
    return adapter.createGenerate(credentials)(request, signal, onChunk);
  },
};

/** One authenticated call that spends no tokens. Nothing is kept after it returns. */
export function verifyKey(
  credentials: ModelCredentials,
  signal: AbortSignal,
): Promise<Result<void>> {
  const adapter = adapterOf(credentials.adapter);
  if (adapter === undefined) return Promise.resolve(unknownAdapter());
  return adapter.verifyKey(credentials, signal);
}
