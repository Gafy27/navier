import { appError, err, ErrorCode, ok } from '../../index.ts';
import type { Logger, Result } from '../../index.ts';
import { createClientCredentialsToken } from '../../identity/index.ts';
import { apiNotFound } from './errors.ts';
import type { ApiFailure } from './errors.ts';
import type { IdpDirectoryConfig } from './idp-directory-config.ts';

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const SUBJECT = '{subject}';

const unavailable = appError(
  ErrorCode.unavailable,
  'identity provider unavailable',
);

/** `ok` on HTTP 200, `not_found` on 404, `unavailable` otherwise. */
export interface IdpDirectory {
  readonly userExists: (subject: string) => Promise<Result<void, ApiFailure>>;
}

/** User lookup over fetch. The bearer token comes from the shared supplier. */
export function createIdpDirectory(
  config: IdpDirectoryConfig,
  logger: Logger,
): IdpDirectory {
  const token = createClientCredentialsToken(
    {
      tokenUrl: config.IDP_DIRECTORY_TOKEN_URL,
      clientId: config.IDP_DIRECTORY_CLIENT_ID,
      secretFile: config.IDP_DIRECTORY_CLIENT_SECRET_FILE,
      timeoutMs: config.IDP_DIRECTORY_TIMEOUT_MS,
      ...(config.IDP_DIRECTORY_AUDIENCE === undefined
        ? {}
        : { audience: config.IDP_DIRECTORY_AUDIENCE }),
    },
    logger,
  );

  return {
    async userExists(subject) {
      const credential = await token();
      if (credential === undefined) return err(unavailable);
      const url = config.IDP_DIRECTORY_USER_URL.replace(
        SUBJECT,
        encodeURIComponent(subject),
      );
      try {
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${credential.reveal()}` },
          signal: AbortSignal.timeout(config.IDP_DIRECTORY_TIMEOUT_MS),
        });
        await res.body?.cancel();
        if (res.status === HTTP_OK) return ok(undefined);
        logger.error({ status: res.status }, 'directory user lookup failed');
        return err(res.status === HTTP_NOT_FOUND ? apiNotFound : unavailable);
      } catch {
        logger.error('directory user lookup unreachable');
        return err(unavailable);
      }
    },
  };
}
