import { readFileSync } from 'node:fs';
import { appError, ErrorCode, err } from '../index.ts';
import type { Result } from '../index.ts';
import {
  parseOrgPatch,
  readOrgConfig,
  readProviderStatus,
  setOrgConfig,
  setProvider,
  setProviderKey,
} from '../orgconfig/index.ts';
import { ADAPTER_NAMES, verifyKey } from '../runtime/index.ts';
import { SdkError } from '../sdk/index.ts';
import { withSession } from './publish.ts';
import type { PublishOptions, Session } from './publish.ts';

const ADMIN_SCOPE = 'org:config:admin';

const SNAPSHOT_FIELDS = [
  'maxToolsPerVersion',
  'maxFallbacks',
  'maxSteps',
  'pauseTimeout',
  'maxTraceOutputBytes',
  'maxToolOutputBytes',
  'maxToolAttempts',
  'streamReplayTtl',
  'streamAccessRecheck',
  'streamPollHold',
  'streamKeepalive',
  'streamMaxLifetime',
  'maxStreamDeltasPerMessage',
] as const;

const intFields = new Set<string>([
  'maxToolsPerVersion',
  'maxFallbacks',
  'maxSteps',
  'maxTraceOutputBytes',
  'maxToolOutputBytes',
  'maxToolAttempts',
  'maxStreamDeltasPerMessage',
]);

function fail(code: ErrorCode, message: string): never {
  throw new SdkError(appError(code, message));
}

function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  return fail(result.error.code, result.error.message);
}

async function requireAdmin(session: Session): Promise<void> {
  const decision = unwrap(
    await session.authz.check(session.org, session.caller, ADMIN_SCOPE),
  );
  if (!decision.allow) {
    fail(ErrorCode.permission_denied, `missing ${ADMIN_SCOPE}`);
  }
}

function parseAssignments(
  args: readonly string[],
): Result<Record<string, unknown>> {
  if (args.length === 0) {
    return err(appError(ErrorCode.invalid_argument, 'config: invalid'));
  }
  const patch: Record<string, unknown> = {};
  for (const arg of args) {
    if (arg.startsWith('-')) {
      return err(appError(ErrorCode.invalid_argument, 'key: invalid'));
    }
    const eq = arg.indexOf('=');
    if (eq === -1) {
      return err(appError(ErrorCode.invalid_argument, 'config: invalid'));
    }
    const field = arg.slice(0, eq);
    if (!(SNAPSHOT_FIELDS as readonly string[]).includes(field)) {
      return err(appError(ErrorCode.invalid_argument, `${field}: invalid`));
    }
    const raw = arg.slice(eq + 1);
    if (intFields.has(field)) {
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) {
        return err(appError(ErrorCode.invalid_argument, `${field}: invalid`));
      }
      patch[field] = n;
    } else {
      patch[field] = raw;
    }
  }
  return parseOrgPatch(patch);
}

export function showOrgConfig(options: PublishOptions): Promise<object> {
  return withSession(options, async (session) => {
    await requireAdmin(session);
    return readOrgConfig(session.db, session.org);
  });
}

export function setOrgConfigFields(
  assignments: readonly string[],
  options: PublishOptions,
): Promise<{ seq: number }> {
  const parsed = parseAssignments(assignments);
  if (!parsed.ok) return Promise.reject(new SdkError(parsed.error));
  const patch = parsed.value;
  return withSession(options, async (session) =>
    unwrap(
      await setOrgConfig(
        session.authz,
        session.db,
        session.caller,
        session.org,
        patch,
      ),
    ),
  );
}

export function showProvider(
  provider: string,
  options: PublishOptions,
): Promise<object> {
  return withSession(options, async (session) => {
    await requireAdmin(session);
    return readProviderStatus(session.db, session.org, provider);
  });
}

export function setProviderRow(
  provider: string,
  adapter: string,
  baseUrl: string,
  options: PublishOptions,
): Promise<{ seq: number }> {
  return withSession(options, async (session) =>
    unwrap(
      await setProvider(
        session.authz,
        session.db,
        session.caller,
        session.org,
        { provider, adapter, baseUrl },
        ADAPTER_NAMES,
      ),
    ),
  );
}

function readStdinKey(): string {
  const text = readFileSync(0, 'utf8');
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

export function setProviderKeyFromStdin(
  provider: string,
  extra: readonly string[],
  options: PublishOptions,
): Promise<{ seq: number }> {
  if (extra.length > 0) {
    return Promise.reject(
      new SdkError(appError(ErrorCode.invalid_argument, 'key: invalid')),
    );
  }
  const plaintext = readStdinKey();
  if (plaintext.length === 0) {
    return Promise.reject(
      new SdkError(appError(ErrorCode.invalid_argument, 'key: invalid')),
    );
  }
  // The verify call is the only wait the user can cut short.
  const interrupt = new AbortController();
  const abort = () => {
    interrupt.abort();
  };
  process.once('SIGINT', abort);
  return withSession(options, async (session) =>
    unwrap(
      await setProviderKey(
        session.authz,
        session.db,
        session.caller,
        session.org,
        provider,
        plaintext,
        verifyKey,
        interrupt.signal,
      ),
    ),
  ).finally(() => {
    process.off('SIGINT', abort);
  });
}
