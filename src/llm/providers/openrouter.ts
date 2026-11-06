import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { OpenRouterProviderOptions } from '@openrouter/ai-sdk-provider';
import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { createProviderGenerate } from './generate.ts';
import type { EffortOptions } from './generate.ts';
import { verifyKeyFetch } from './verify-key-fetch.ts';

/** OpenAI-compatible function names are at most 64 characters. */
const TOOL_NAME_MAX = 64;

type OpenRouterEffort = Extract<
  NonNullable<OpenRouterProviderOptions['reasoning']>,
  { effort: string }
>['effort'];

const EFFORTS = [
  'xhigh',
  'high',
  'medium',
  'low',
  'minimal',
  'none',
] as const satisfies readonly OpenRouterEffort[];

const invalid = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

function effortOptions(
  effort: string | null,
): Result<EffortOptions | undefined> {
  if (effort === null) return ok(undefined);
  const known = EFFORTS.find((e) => e === effort);
  if (known === undefined) return invalid('reasoningEffort: not accepted');
  return ok({ openrouter: { reasoning: { effort: known } } });
}

/** Builds `generate` for one call. The key lives only in this closure. */
export function createOpenRouterGenerate(entry: {
  readonly apiKey: string;
  readonly baseUrl: string;
}) {
  const provider = createOpenRouter({
    apiKey: entry.apiKey,
    baseURL: entry.baseUrl,
    compatibility: 'strict',
  });
  return createProviderGenerate({
    model: (modelId) => provider.chat(modelId),
    toolNameMax: TOOL_NAME_MAX,
    effortOptions,
  });
}

/** One `GET /key`: unlike `/models`, it needs a valid key and spends no tokens. */
export function verifyOpenRouterKey(
  entry: { readonly apiKey: string; readonly baseUrl: string },
  signal: AbortSignal,
): Promise<Result<void>> {
  return verifyKeyFetch(
    `${entry.baseUrl}/key`,
    { authorization: `Bearer ${entry.apiKey}` },
    signal,
  );
}
