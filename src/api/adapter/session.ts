import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { appError, err, ErrorCode, ok, z } from '../../index.ts';
import type { Logger, Result } from '../../index.ts';
import { withTables, withTransaction } from '../../db/index.ts';
import type { Db, Tx } from '../../db/index.ts';
import { createCredential } from '../../identity/index.ts';
import type { Caller, CallerVerifier } from '../../identity/index.ts';
import { sealWithKeyring, unsealWithKeyring } from '../../orgconfig/keyring.ts';
import { ApiTable, apiView } from '../db/tables.ts';
import type { ApiTables, SealedColumns, SealedTable } from '../db/tables.ts';
import { unauthenticated } from './errors.ts';
import type { LoginConfig } from './login-config.ts';
import { RefreshOutcome } from './oidc.ts';
import type { IdpTokens, OidcClient } from './oidc.ts';
import { Method } from './route-types.ts';

/** Every session id starts with this; no machine token may (D1). */
export const SESSION_PREFIX = 'ses_';
const SESSION_ID_BYTES = 32;
/** The session cookie's name (B3). */
export const SESSION_COOKIE = 'session_id';
const COOKIE_ATTRIBUTES = 'HttpOnly; Secure; SameSite=Lax; Path=/api/v1';

/** How the caller authenticated. */
export const Via = z.enum({ bearer: 'bearer', session: 'session' });
export type Via = z.infer<typeof Via>;

export interface SessionDeps {
  readonly db: Db;
  readonly verifier: CallerVerifier;
  readonly oidc: OidcClient;
  readonly config: LoginConfig;
  readonly log: Logger;
}

/** `cookie` only when the session came from the cookie (PD5). */
export type Presentation = 'cookie' | 'authorization';

export interface ResolvedCaller {
  readonly caller: Caller;
  readonly via: Via;
  readonly presentation: Presentation;
  readonly sessionHash?: string;
  /** Session: idle check, refresh under lock, verify (PD7). Bearer: same `Caller`. */
  readonly refresh: (signal: AbortSignal) => Promise<Result<Caller>>;
}

/** The plaintext sealed in a session row (B11). */
const StoredTokens = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.iso.datetime(),
});

const UNSAFE: ReadonlySet<Method> = new Set([
  Method.enum.POST,
  Method.enum.PUT,
  Method.enum.PATCH,
  Method.enum.DELETE,
]);

const bearer = /^Bearer (\S+)$/iu;

/** Lowercase hex SHA-256 (B5). */
export const sha256Hex = (text: string) =>
  createHash('sha256').update(text).digest('hex');

export const sessionCookie = (id: string) =>
  `${SESSION_COOKIE}=${id}; ${COOKIE_ATTRIBUTES}`;

export const clearedSessionCookie = () =>
  `${SESSION_COOKIE}=; Max-Age=0; ${COOKIE_ATTRIBUTES}`;

function cookieValue(header: string | undefined): string | undefined {
  for (const pair of header?.split(';') ?? []) {
    const [name, ...value] = pair.trim().split('=');
    if (name === SESSION_COOKIE) return value.join('=');
  }
  return undefined;
}

/** Seals `plaintext` into envelope columns bound to `[table, rowHash]` (PD2). */
export function sealColumns(
  plaintext: string,
  table: SealedTable,
  rowHash: string,
): Result<SealedColumns> {
  const sealed = sealWithKeyring(plaintext, [table, rowHash]);
  if (!sealed.ok) return sealed;
  const { keyId, wrappedKey, wrapNonce, dataNonce, ciphertext } = sealed.value;
  return ok({
    key_id: keyId,
    wrapped_key: wrappedKey,
    wrap_nonce: wrapNonce,
    data_nonce: dataNonce,
    ciphertext,
  });
}

/** Opens columns that `sealColumns` sealed with the same table and hash. */
export function openColumns(
  row: SealedColumns,
  table: SealedTable,
  rowHash: string,
): Result<string> {
  return unsealWithKeyring(
    {
      keyId: row.key_id,
      wrappedKey: row.wrapped_key,
      wrapNonce: row.wrap_nonce,
      dataNonce: row.data_nonce,
      ciphertext: row.ciphertext,
    },
    [table, rowHash],
  );
}

const sealTokens = (tokens: IdpTokens, idHash: string) =>
  sealColumns(
    JSON.stringify({
      accessToken: tokens.accessToken.reveal(),
      refreshToken: tokens.refreshToken?.reveal(),
      expiresAt: tokens.expiresAt.toISOString(),
    }),
    ApiTable.enum.api_session,
    idHash,
  );

/** Seals the tokens into a new row. Returns the id; only its hash is stored. */
export async function createSession(
  deps: SessionDeps,
  tokens: IdpTokens,
): Promise<Result<{ readonly sessionId: string }>> {
  const sessionId =
    SESSION_PREFIX + randomBytes(SESSION_ID_BYTES).toString('base64url');
  const idHash = sha256Hex(sessionId);
  const columns = sealTokens(tokens, idHash);
  if (!columns.ok) return columns;
  await apiView(deps.db)
    .insertInto(ApiTable.enum.api_session)
    .values({ id_hash: idHash, ...columns.value })
    .execute();
  return ok({ sessionId });
}

/** Deletes the session row. A missing row is ok. */
export async function endSession(
  db: Db,
  sessionHash: string,
): Promise<Result<void>> {
  await apiView(db)
    .deleteFrom(ApiTable.enum.api_session)
    .where('id_hash', '=', sessionHash)
    .execute();
  return ok(undefined);
}

const LookupKind = z.enum({ ended: 'ended', access: 'access' });

type Lookup =
  | { readonly kind: typeof LookupKind.enum.ended }
  | { readonly kind: typeof LookupKind.enum.access; readonly token: string };

const ENDED: Lookup = { kind: LookupKind.enum.ended };

/** Locks the row, ends it when idle or refused, refreshes it when expired (D3, PD4). */
async function lockedAccessToken(
  deps: SessionDeps,
  tx: Tx,
  idHash: string,
): Promise<Result<Lookup>> {
  const t = withTables<ApiTables>(tx);
  const row = await t
    .selectFrom(ApiTable.enum.api_session)
    .selectAll()
    .select(
      sql<boolean>`refreshed_at < now() - ${deps.config.SESSION_IDLE_MS} * interval '1 millisecond'`.as(
        'idle',
      ),
    )
    .where('id_hash', '=', idHash)
    .forUpdate()
    .executeTakeFirst();
  if (row === undefined) return ok(ENDED);
  const remove = async () => {
    await t
      .deleteFrom(ApiTable.enum.api_session)
      .where('id_hash', '=', idHash)
      .execute();
    return ok(ENDED);
  };
  if (row.idle) return remove();

  const opened = openColumns(row, ApiTable.enum.api_session, idHash);
  if (!opened.ok) return opened;
  const stored = StoredTokens.parse(JSON.parse(opened.value));
  if (new Date(stored.expiresAt).getTime() > Date.now()) {
    await t
      .updateTable(ApiTable.enum.api_session)
      .set({ refreshed_at: sql`now()` })
      .where('id_hash', '=', idHash)
      .execute();
    return ok({ kind: LookupKind.enum.access, token: stored.accessToken });
  }

  if (stored.refreshToken === undefined) return remove();
  const refreshToken = createCredential(stored.refreshToken);
  const answer = await deps.oidc.refresh(refreshToken, AbortSignal.any([]));
  if (!answer.ok) return answer;
  if (answer.value === RefreshOutcome.enum.refused) return remove();
  const next = answer.value;
  const columns = sealTokens(
    {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken ?? refreshToken,
      expiresAt: next.expiresAt,
    },
    idHash,
  );
  if (!columns.ok) return columns;
  await t
    .updateTable(ApiTable.enum.api_session)
    .set({ ...columns.value, refreshed_at: sql`now()` })
    .where('id_hash', '=', idHash)
    .execute();
  return ok({ kind: LookupKind.enum.access, token: next.accessToken.reveal() });
}

const providerUnavailable = () =>
  err(appError(ErrorCode.unavailable, 'identity provider unavailable'));

/** Re-runs `lockedAccessToken` then verify (PD7, L3). */
async function sessionRefresh(
  deps: SessionDeps,
  idHash: string,
  signal: AbortSignal,
): Promise<Result<Caller>> {
  if (signal.aborted) return providerUnavailable();
  const lookup = await withTransaction(deps.db, (tx) =>
    lockedAccessToken(deps, tx, idHash),
  );
  if (!lookup.ok) return lookup;
  if (lookup.value.kind === LookupKind.enum.ended) return unauthenticated();
  return deps.verifier.verify(`Bearer ${lookup.value.token}`);
}

/**
 * The only reader of `Authorization` and the session cookie (PD6). A `ses_`
 * value resolves through its session row; anything else goes to the verifier.
 */
export async function resolveCaller(
  deps: SessionDeps,
  req: {
    readonly authorization?: string | undefined;
    readonly cookie?: string | undefined;
    readonly method: Method;
    readonly origin?: string | undefined;
  },
): Promise<Result<ResolvedCaller>> {
  const fromCookie = req.authorization === undefined;
  const presented = fromCookie
    ? cookieValue(req.cookie)
    : bearer.exec(req.authorization)?.[1];
  if (presented?.startsWith(SESSION_PREFIX) !== true) {
    const verified = await deps.verifier.verify(req.authorization);
    if (!verified.ok) return verified;
    const caller = verified.value;
    return ok({
      caller,
      via: Via.enum.bearer,
      presentation: 'authorization',
      refresh: () => Promise.resolve(ok(caller)),
    });
  }

  const idHash = sha256Hex(presented);
  const lookup = await withTransaction(deps.db, (tx) =>
    lockedAccessToken(deps, tx, idHash),
  );
  if (!lookup.ok) return lookup;
  if (lookup.value.kind === LookupKind.enum.ended) return unauthenticated();
  const verified = await deps.verifier.verify(`Bearer ${lookup.value.token}`);
  if (!verified.ok) return verified;
  const presentation: Presentation = fromCookie ? 'cookie' : 'authorization';
  if (
    presentation === 'cookie' &&
    UNSAFE.has(req.method) &&
    req.origin !== new URL(deps.config.IDP_REDIRECT_URL).origin
  ) {
    return err(appError(ErrorCode.permission_denied, 'forbidden'));
  }
  const caller = verified.value;
  return ok({
    caller,
    via: Via.enum.session,
    presentation,
    sessionHash: idHash,
    refresh: (signal) => sessionRefresh(deps, idHash, signal),
  });
}
