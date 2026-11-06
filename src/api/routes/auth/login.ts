import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { sql } from 'kysely';
import { appError, err, ErrorCode, ok, z } from '../../../index.ts';
import type { Result } from '../../../index.ts';
import type { Db } from '../../../db/index.ts';
import { unauthenticated } from '../../adapter/errors.ts';
import type { LoginConfig } from '../../adapter/login-config.ts';
import type { OidcClient } from '../../adapter/oidc.ts';
import {
  createSession,
  openColumns,
  sealColumns,
  sha256Hex,
} from '../../adapter/session.ts';
import type { SessionDeps } from '../../adapter/session.ts';
import { ApiTable, apiView } from '../../db/tables.ts';

const RANDOM_BYTES = 32;
const STATE_TABLE = ApiTable.enum.api_login_state;
const HANDOFF_TABLE = ApiTable.enum.api_login_handoff;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', '[::1]']);
/** A base64url SHA-256 digest: 43 characters (PD1, D1). */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/u;

/** A CLI loopback login (P13.7 D1): where the code goes, and the proof it must match. */
export interface Handoff {
  readonly return: string;
  readonly challenge: string;
}

/** The login-state plaintext (PD1). A bare verifier from before the deploy is also read. */
const LoginState = z.strictObject({
  verifier: z.string().min(1),
  return: z.string().optional(),
  handoffChallenge: z.string().optional(),
});
type LoginState = z.infer<typeof LoginState>;

const invalid = () =>
  err(appError(ErrorCode.invalid_argument, 'invalid request'));

/** `return` and `handoff_challenge` come as a pair or not at all (PD3). */
export function parseHandoff(query: {
  readonly return?: string | undefined;
  readonly handoff_challenge?: string | undefined;
}): Result<Handoff | undefined> {
  const { return: target, handoff_challenge: challenge } = query;
  if (target === undefined && challenge === undefined) return ok(undefined);
  if (target === undefined || challenge === undefined) return invalid();
  if (!CHALLENGE.test(challenge)) return invalid();
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return invalid();
  }
  const loopback =
    LOOPBACK_HOSTS.has(url.hostname) &&
    url.pathname === '/callback' &&
    url.username === '' &&
    url.password === '' &&
    !target.includes('#');
  return loopback ? ok({ return: target, challenge }) : invalid();
}

/**
 * Reads the sealed plaintext: JSON with the state shape, or else a bare
 * verifier written before the deploy (PD1, B3). A bare verifier can parse as
 * JSON (a number), so a wrong shape also falls back to the bare verifier.
 */
function readLoginState(plaintext: string): LoginState {
  let json: unknown;
  try {
    json = JSON.parse(plaintext);
  } catch {
    return { verifier: plaintext };
  }
  const parsed = LoginState.safeParse(json);
  return parsed.success ? parsed.data : { verifier: plaintext };
}

/** Stores a sealed PKCE verifier under a fresh `state`; returns the authorize URL (L1). */
export async function beginLogin(
  db: Db,
  oidc: OidcClient,
  config: LoginConfig,
  handoff?: Handoff,
): Promise<Result<{ readonly location: URL }>> {
  const state = randomBytes(RANDOM_BYTES).toString('base64url');
  const verifier = randomBytes(RANDOM_BYTES).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const plaintext = JSON.stringify({
    verifier,
    return: handoff?.return,
    handoffChallenge: handoff?.challenge,
  });
  const sealed = sealColumns(plaintext, STATE_TABLE, sha256Hex(state));
  if (!sealed.ok) return sealed;
  await apiView(db)
    .insertInto(STATE_TABLE)
    .values({
      state,
      ...sealed.value,
      expires_at: sql<Date>`now() + ${config.LOGIN_STATE_TTL_MS} * interval '1 millisecond'`,
    })
    .execute();
  return ok({ location: oidc.authorizeUrl(state, challenge) });
}

export type FinishLoginResult =
  | { readonly kind: 'cookie'; readonly sessionId: string }
  | { readonly kind: 'handoff'; readonly location: URL };

/** Seals the session id under a fresh one-time code and sends the browser to `return` (D1, PD1). */
async function handoffFor(
  deps: SessionDeps,
  sessionId: string,
  state: { readonly return: string; readonly handoffChallenge: string },
): Promise<Result<FinishLoginResult>> {
  const code = randomBytes(RANDOM_BYTES).toString('base64url');
  const codeHash = sha256Hex(code);
  const sealed = sealColumns(sessionId, HANDOFF_TABLE, codeHash);
  if (!sealed.ok) return sealed;
  await apiView(deps.db)
    .insertInto(HANDOFF_TABLE)
    .values({
      code_hash: codeHash,
      challenge: state.handoffChallenge,
      ...sealed.value,
      expires_at: sql<Date>`now() + ${deps.config.LOGIN_HANDOFF_TTL_MS} * interval '1 millisecond'`,
    })
    .execute();
  const location = new URL(state.return);
  location.searchParams.set('handoff', code);
  return ok({ kind: 'handoff', location });
}

/** Spends `state`, exchanges the code, proves the token, and opens a session (L1, PD4). */
export async function finishLogin(
  deps: SessionDeps,
  query: { readonly state: string; readonly code: string },
): Promise<Result<FinishLoginResult>> {
  const t = apiView(deps.db);
  const row = await t
    .deleteFrom(STATE_TABLE)
    .where('state', '=', query.state)
    .where('expires_at', '>', sql<Date>`now()`)
    .returningAll()
    .executeTakeFirst();
  if (row === undefined) return unauthenticated();
  const opened = openColumns(row, STATE_TABLE, sha256Hex(query.state));
  if (!opened.ok) return opened;
  const state = readLoginState(opened.value);
  if (state.return !== undefined && state.handoffChallenge === undefined) {
    return unauthenticated();
  }

  await t
    .deleteFrom(STATE_TABLE)
    .where(
      sql<string>`ctid`,
      'in',
      t
        .selectFrom(STATE_TABLE)
        .select(sql<string>`ctid`.as('ctid'))
        .where('expires_at', '<=', sql<Date>`now()`)
        .limit(deps.config.LOGIN_STATE_DELETE_MAX),
    )
    .execute();
  await t
    .deleteFrom(HANDOFF_TABLE)
    .where(
      sql<string>`ctid`,
      'in',
      t
        .selectFrom(HANDOFF_TABLE)
        .select(sql<string>`ctid`.as('ctid'))
        .where('expires_at', '<=', sql<Date>`now()`)
        .limit(deps.config.LOGIN_STATE_DELETE_MAX),
    )
    .execute();

  const tokens = await deps.oidc.exchange(
    query.code,
    state.verifier,
    AbortSignal.any([]),
  );
  if (!tokens.ok) return tokens;
  const proved = await deps.verifier.verify(
    `Bearer ${tokens.value.accessToken.reveal()}`,
  );
  if (!proved.ok) return proved;
  const created = await createSession(deps, tokens.value);
  if (!created.ok) return created;
  const { return: target, handoffChallenge } = state;
  if (target === undefined || handoffChallenge === undefined) {
    return ok({ kind: 'cookie', sessionId: created.value.sessionId });
  }
  return handoffFor(deps, created.value.sessionId, {
    return: target,
    handoffChallenge,
  });
}

/** True when `SHA-256(verifier)` in base64url equals `challenge`, compared in constant time. */
function matchesChallenge(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(
    createHash('sha256').update(verifier).digest('base64url'),
  );
  const expected = Buffer.from(challenge);
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}

/**
 * Spends a one-time code and checks its verifier (PD1). The row is deleted
 * first, so a wrong verifier also spends the code (D1).
 */
export async function redeemHandoff(
  deps: SessionDeps,
  body: { readonly handoff: string; readonly verifier: string },
): Promise<Result<{ readonly session: string }>> {
  const codeHash = sha256Hex(body.handoff);
  const row = await apiView(deps.db)
    .deleteFrom(HANDOFF_TABLE)
    .where('code_hash', '=', codeHash)
    .where('expires_at', '>', sql<Date>`now()`)
    .returningAll()
    .executeTakeFirst();
  if (row === undefined) return unauthenticated();
  if (!matchesChallenge(body.verifier, row.challenge)) return unauthenticated();
  const session = openColumns(row, HANDOFF_TABLE, codeHash);
  if (!session.ok) return session;
  return ok({ session: session.value });
}
