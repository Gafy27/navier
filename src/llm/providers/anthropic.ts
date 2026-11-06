import { createAnthropic } from '@ai-sdk/anthropic';
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { createProviderGenerate } from './generate.ts';
import type { EffortOptions } from './generate.ts';
import { verifyKeyFetch } from './verify-key-fetch.ts';

/** Anthropic's tool-name pattern is `^[a-zA-Z0-9_-]{1,128}$`. */
const TOOL_NAME_MAX = 128;
const EFFORTS = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const satisfies readonly NonNullable<
  AnthropicLanguageModelOptions['effort']
>[];

/** Sent with every request; the provider rejects a call without it. */
const ANTHROPIC_VERSION = '2023-06-01';

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

function effortOptions(
  effort: string | null,
): Result<EffortOptions | undefined> {
  if (effort === null) return ok(undefined);
  const known = EFFORTS.find((e) => e === effort);
  if (known === undefined) return invalid('reasoningEffort: not accepted');
  return ok({ anthropic: { effort: known } });
}

/** Builds `generate` for one call. The key lives only in this closure. */
export function createAnthropicGenerate(entry: {
  readonly apiKey: string;
  readonly baseUrl: string;
}) {
  const provider = createAnthropic({
    apiKey: entry.apiKey,
    baseURL: entry.baseUrl,
  });
  return createProviderGenerate({
    model: (modelId) => provider(modelId),
    toolNameMax: TOOL_NAME_MAX,
    effortOptions,
  });
}

/** One `GET /models?limit=1`: it spends no tokens and fails without a valid key. */
export function verifyAnthropicKey(
  entry: { readonly apiKey: string; readonly baseUrl: string },
  signal: AbortSignal,
): Promise<Result<void>> {
  return verifyKeyFetch(
    `${entry.baseUrl}/models?limit=1`,
    { 'x-api-key': entry.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    signal,
  );
}
