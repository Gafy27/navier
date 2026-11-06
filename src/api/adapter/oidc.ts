import { readFileSync } from 'node:fs';
import { appError, err, ErrorCode, ok, z } from '../../index.ts';
import type { Result } from '../../index.ts';
import { createCredential } from '../../identity/index.ts';
import type { Credential } from '../../identity/index.ts';
import { unauthenticated } from './errors.ts';
import type { LoginConfig } from './login-config.ts';

/** The provider's tokens. Each token prints, serializes, and inspects redacted. */
export interface IdpTokens {
  readonly accessToken: Credential;
  readonly refreshToken?: Credential;
  readonly expiresAt: Date;
}

/** A refresh the provider turned down with `invalid_grant` (D3, B12). */
export const RefreshOutcome = z.enum({ refused: 'refused' });

/** The code flow with PKCE (L1) and the refresh grant (D3), over fetch. */
export interface OidcClient {
  readonly authorizeUrl: (state: string, challenge: string) => URL;
  readonly exchange: (
    code: string,
    verifier: string,
    signal: AbortSignal,
  ) => Promise<Result<IdpTokens>>;
  readonly refresh: (
    refresh: Credential,
    signal: AbortSignal,
  ) => Promise<Result<IdpTokens | typeof RefreshOutcome.enum.refused>>;
}

const GrantType = z.enum({
  authorization_code: 'authorization_code',
  refresh_token: 'refresh_token',
});

/** The token endpoint `error` code for a dead refresh token (RFC 6749 § 5.2). */
const TokenError = z.enum({ invalid_grant: 'invalid_grant' });

const ResponseType = z.enum({ code: 'code' });

/** The only PKCE method sent (L1). */
const ChallengeMethod = z.enum({ S256: 'S256' });

const AnswerKind = z.enum({
  tokens: 'tokens',
  rejected: 'rejected',
  unavailable: 'unavailable',
});

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
});

const ErrorResponse = z.object({ error: z.string() });

/** Seconds to milliseconds. A unit, not a limit. */
const MS_PER_S = 10 ** 3;

const unavailable = () =>
  err(appError(ErrorCode.unavailable, 'identity provider unavailable'));

type TokenAnswer =
  | { readonly kind: typeof AnswerKind.enum.tokens; readonly tokens: IdpTokens }
  | {
      readonly kind: typeof AnswerKind.enum.rejected;
      readonly error: string | undefined;
    }
  | { readonly kind: typeof AnswerKind.enum.unavailable };

const UNAVAILABLE: TokenAnswer = { kind: AnswerKind.enum.unavailable };

/** Reads `IDP_CLIENT_SECRET_FILE` once. A message names the variable, never the secret. */
export function createOidcClient(
  config: LoginConfig,
  apiAudience?: string,
): Result<OidcClient> {
  let text: string;
  try {
    text = readFileSync(config.IDP_CLIENT_SECRET_FILE, 'utf8').trim();
  } catch {
    return err(
      appError(
        ErrorCode.invalid_argument,
        'IDP_CLIENT_SECRET_FILE: unreadable',
      ),
    );
  }
  if (text === '') {
    return err(
      appError(ErrorCode.invalid_argument, 'IDP_CLIENT_SECRET_FILE: invalid'),
    );
  }
  const secret = createCredential(text);

  async function postToken(
    grant: Record<string, string>,
    signal: AbortSignal,
  ): Promise<TokenAnswer> {
    const body = new URLSearchParams({
      ...grant,
      client_id: config.IDP_CLIENT_ID,
      client_secret: secret.reveal(),
    });
    try {
      const res = await fetch(config.IDP_TOKEN_URL, {
        method: 'POST',
        body,
        signal,
      });
      const json: unknown = await res.json().catch(() => undefined);
      if (res.status >= 500) return UNAVAILABLE;
      if (!res.ok) {
        const parsed = ErrorResponse.safeParse(json);
        return {
          kind: AnswerKind.enum.rejected,
          error: parsed.success ? parsed.data.error : undefined,
        };
      }
      const parsed = TokenResponse.safeParse(json);
      if (!parsed.success) return UNAVAILABLE;
      const { access_token, refresh_token, expires_in } = parsed.data;
      const expiresAt = new Date(Date.now() + expires_in * MS_PER_S);
      const accessToken = createCredential(access_token);
      return {
        kind: AnswerKind.enum.tokens,
        tokens:
          refresh_token === undefined
            ? { accessToken, expiresAt }
            : {
                accessToken,
                refreshToken: createCredential(refresh_token),
                expiresAt,
              },
      };
    } catch {
      return UNAVAILABLE;
    }
  }

  return ok({
    authorizeUrl: (state, challenge) => {
      const url = new URL(config.IDP_AUTHORIZE_URL);
      url.searchParams.set('response_type', ResponseType.enum.code);
      url.searchParams.set('client_id', config.IDP_CLIENT_ID);
      url.searchParams.set('redirect_uri', config.IDP_REDIRECT_URL);
      url.searchParams.set('scope', config.IDP_SCOPES);
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', challenge);
      url.searchParams.set('code_challenge_method', ChallengeMethod.enum.S256);
      if (apiAudience !== undefined && apiAudience !== '') {
        url.searchParams.set('audience', apiAudience);
      }
      return url;
    },
    exchange: async (code, verifier, signal) => {
      const grant: Record<string, string> = {
        grant_type: GrantType.enum.authorization_code,
        code,
        code_verifier: verifier,
        redirect_uri: config.IDP_REDIRECT_URL,
      };
      if (apiAudience !== undefined && apiAudience !== '') {
        grant['audience'] = apiAudience;
      }
      const answer = await postToken(grant, signal);
      if (answer.kind === AnswerKind.enum.tokens) return ok(answer.tokens);
      return answer.kind === AnswerKind.enum.rejected
        ? unauthenticated()
        : unavailable();
    },
    refresh: async (refresh, signal) => {
      const answer = await postToken(
        {
          grant_type: GrantType.enum.refresh_token,
          refresh_token: refresh.reveal(),
        },
        signal,
      );
      if (answer.kind === AnswerKind.enum.tokens) return ok(answer.tokens);
      if (answer.kind === AnswerKind.enum.unavailable) return unavailable();
      return answer.error === TokenError.enum.invalid_grant
        ? ok(RefreshOutcome.enum.refused)
        : unauthenticated();
    },
  });
}
