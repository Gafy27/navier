import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { z } from '../../index.ts';
import { CliFailure, CliUsage } from './failure.ts';

/** Process variable names. The contract test holds them to the config schemas. */
export const ServerVariable = z.enum({
  LOG_LEVEL: 'LOG_LEVEL',
  SHUTDOWN_TIMEOUT_MS: 'SHUTDOWN_TIMEOUT_MS',
  START_GRACE_MS: 'START_GRACE_MS',
  MAX_HISTORY_LENGTH: 'MAX_HISTORY_LENGTH',
  DATABASE_URL: 'DATABASE_URL',
  DATABASE_POOL_MAX: 'DATABASE_POOL_MAX',
  HEALTH_HOST: 'HEALTH_HOST',
  HEALTH_PORT: 'HEALTH_PORT',
  PROBE_TIMEOUT_MS: 'PROBE_TIMEOUT_MS',
  TEMPORAL_ADDRESS: 'TEMPORAL_ADDRESS',
  TEMPORAL_NAMESPACE: 'TEMPORAL_NAMESPACE',
  TEMPORAL_TASK_QUEUE: 'TEMPORAL_TASK_QUEUE',
  API_HOST: 'API_HOST',
  API_PORT: 'API_PORT',
  API_BODY_MAX_BYTES: 'API_BODY_MAX_BYTES',
  PROVIDER_VERIFY_TIMEOUT_MS: 'PROVIDER_VERIFY_TIMEOUT_MS',
  STREAM_READ_BATCH_SIZE: 'STREAM_READ_BATCH_SIZE',
  NODE_ENV: 'NODE_ENV',
  IDP_AUTHORIZE_URL: 'IDP_AUTHORIZE_URL',
  IDP_TOKEN_URL: 'IDP_TOKEN_URL',
  IDP_CLIENT_ID: 'IDP_CLIENT_ID',
  IDP_CLIENT_SECRET_FILE: 'IDP_CLIENT_SECRET_FILE',
  IDP_REDIRECT_URL: 'IDP_REDIRECT_URL',
  IDP_SCOPES: 'IDP_SCOPES',
  LOGIN_STATE_TTL_MS: 'LOGIN_STATE_TTL_MS',
  LOGIN_STATE_DELETE_MAX: 'LOGIN_STATE_DELETE_MAX',
  LOGIN_HANDOFF_TTL_MS: 'LOGIN_HANDOFF_TTL_MS',
  SESSION_IDLE_MS: 'SESSION_IDLE_MS',
  SESSION_RECHECK_MS: 'SESSION_RECHECK_MS',
  IDP_ISSUER: 'IDP_ISSUER',
  IDP_AUDIENCE: 'IDP_AUDIENCE',
  IDP_JWKS_URI: 'IDP_JWKS_URI',
  IDP_ALGORITHMS: 'IDP_ALGORITHMS',
  IDP_JWKS_TIMEOUT_MS: 'IDP_JWKS_TIMEOUT_MS',
  IDP_CLOCK_TOLERANCE_S: 'IDP_CLOCK_TOLERANCE_S',
  PRINCIPAL_NAMESPACE: 'PRINCIPAL_NAMESPACE',
  SERVICE_SUBJECT_CLAIM: 'SERVICE_SUBJECT_CLAIM',
  SERVICE_SUBJECT_SUFFIX: 'SERVICE_SUBJECT_SUFFIX',
  AUTHZ_API_URL: 'AUTHZ_API_URL',
  AUTHZ_TLS: 'AUTHZ_TLS',
  AUTHZ_TIMEOUT_MS: 'AUTHZ_TIMEOUT_MS',
  AUTHZ_CHECK_MAX_ITEMS: 'AUTHZ_CHECK_MAX_ITEMS',
  AUTHZ_TOKEN_URL: 'AUTHZ_TOKEN_URL',
  AUTHZ_CLIENT_ID: 'AUTHZ_CLIENT_ID',
  AUTHZ_CLIENT_SECRET_FILE: 'AUTHZ_CLIENT_SECRET_FILE',
  AUTHZ_AUDIENCE: 'AUTHZ_AUDIENCE',
  MODEL_CALL_TIMEOUT_MS: 'MODEL_CALL_TIMEOUT_MS',
  MODEL_ATTEMPTS: 'MODEL_ATTEMPTS',
  TOOL_CALL_TIMEOUT_MS: 'TOOL_CALL_TIMEOUT_MS',
  STORE_CALL_TIMEOUT_MS: 'STORE_CALL_TIMEOUT_MS',
  REAPER_INTERVAL_MS: 'REAPER_INTERVAL_MS',
  REAPER_BATCH_SIZE: 'REAPER_BATCH_SIZE',
  STREAM_SWEEP_INTERVAL_MS: 'STREAM_SWEEP_INTERVAL_MS',
  STREAM_SWEEP_BATCH_SIZE: 'STREAM_SWEEP_BATCH_SIZE',
  REQUEST_PAGE_SIZE: 'REQUEST_PAGE_SIZE',
  WORKER_TOOLS_TOKEN: 'WORKER_TOOLS_TOKEN',
});
export type ServerVariable = z.infer<typeof ServerVariable>;

/** Files and folders under the project root. */
export const ServerFile = z.enum({
  config: 'config.yaml',
  secretsDir: '.secrets',
  secretsFile: 'server.json',
});

/** Strings the Node file API takes: encodings, the exclusive-write flag, an error code, a temp suffix. */
const FsToken = z.enum({
  utf8: 'utf8',
  hex: 'hex',
  exclusiveWrite: 'wx',
  notFound: 'ENOENT',
  tempSuffix: '.tmp',
});

const ServerMessage = z.enum({
  notInitialized: 'desk project not initialized: run cli init',
  configBad: 'config.yaml is not a valid desk config',
  secretsBad: 'the secrets file is not a valid desk config',
  tokenMissing: 'WORKER_TOOLS_TOKEN is not set: run cli init',
  badDatabaseName:
    'a database name starts with a lowercase letter and holds lowercase letters, digits, and underscores, up to 63 characters',
  badDatabaseUrl: 'the database URL is not valid',
});

/** Postgres folds and limits identifiers; this is the subset the CLI accepts (B7). */
const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/u;
const URL_PATH_SLASH = /^\//u;
const MASKED_PASSWORD = '***';

const CONFIG_FILE_MODE = 0o644;
const SECRETS_FILE_MODE = 0o600;
const SECRETS_DIR_MODE = 0o700;
const TEMP_RANDOM_BYTES = 8;

export interface Variable {
  readonly name: ServerVariable;
  readonly secret: boolean;
  readonly required: boolean;
}

const V = ServerVariable.enum;

/**
 * One row per process variable. `required` means `init` prompts for it, because
 * it has no fallback. A secret goes to `.secrets/server.json`; the rest go to
 * `config.yaml`.
 */
export const VARIABLES: readonly Variable[] = [
  { name: V.LOG_LEVEL, secret: false, required: false },
  { name: V.SHUTDOWN_TIMEOUT_MS, secret: false, required: true },
  { name: V.START_GRACE_MS, secret: false, required: false },
  { name: V.MAX_HISTORY_LENGTH, secret: false, required: false },
  { name: V.DATABASE_URL, secret: true, required: true },
  { name: V.DATABASE_POOL_MAX, secret: false, required: false },
  { name: V.HEALTH_HOST, secret: false, required: true },
  { name: V.HEALTH_PORT, secret: false, required: true },
  { name: V.PROBE_TIMEOUT_MS, secret: false, required: false },
  { name: V.TEMPORAL_ADDRESS, secret: false, required: true },
  { name: V.TEMPORAL_NAMESPACE, secret: false, required: true },
  { name: V.TEMPORAL_TASK_QUEUE, secret: false, required: true },
  { name: V.API_HOST, secret: false, required: true },
  { name: V.API_PORT, secret: false, required: true },
  { name: V.API_BODY_MAX_BYTES, secret: false, required: true },
  { name: V.PROVIDER_VERIFY_TIMEOUT_MS, secret: false, required: false },
  { name: V.STREAM_READ_BATCH_SIZE, secret: false, required: true },
  { name: V.NODE_ENV, secret: false, required: false },
  { name: V.IDP_AUTHORIZE_URL, secret: false, required: true },
  { name: V.IDP_TOKEN_URL, secret: false, required: true },
  { name: V.IDP_CLIENT_ID, secret: false, required: true },
  { name: V.IDP_CLIENT_SECRET_FILE, secret: false, required: true },
  { name: V.IDP_REDIRECT_URL, secret: false, required: true },
  { name: V.IDP_SCOPES, secret: false, required: true },
  { name: V.LOGIN_STATE_TTL_MS, secret: false, required: true },
  { name: V.LOGIN_STATE_DELETE_MAX, secret: false, required: true },
  { name: V.LOGIN_HANDOFF_TTL_MS, secret: false, required: true },
  { name: V.SESSION_IDLE_MS, secret: false, required: true },
  { name: V.SESSION_RECHECK_MS, secret: false, required: true },
  { name: V.IDP_ISSUER, secret: false, required: true },
  { name: V.IDP_AUDIENCE, secret: false, required: true },
  { name: V.IDP_JWKS_URI, secret: false, required: true },
  { name: V.IDP_ALGORITHMS, secret: false, required: true },
  { name: V.IDP_JWKS_TIMEOUT_MS, secret: false, required: true },
  { name: V.IDP_CLOCK_TOLERANCE_S, secret: false, required: true },
  { name: V.PRINCIPAL_NAMESPACE, secret: false, required: true },
  { name: V.SERVICE_SUBJECT_CLAIM, secret: false, required: false },
  { name: V.SERVICE_SUBJECT_SUFFIX, secret: false, required: false },
  { name: V.AUTHZ_API_URL, secret: false, required: true },
  { name: V.AUTHZ_TLS, secret: false, required: false },
  { name: V.AUTHZ_TIMEOUT_MS, secret: false, required: true },
  { name: V.AUTHZ_CHECK_MAX_ITEMS, secret: false, required: true },
  { name: V.AUTHZ_TOKEN_URL, secret: false, required: true },
  { name: V.AUTHZ_CLIENT_ID, secret: false, required: true },
  { name: V.AUTHZ_CLIENT_SECRET_FILE, secret: false, required: true },
  { name: V.AUTHZ_AUDIENCE, secret: false, required: false },
  { name: V.MODEL_CALL_TIMEOUT_MS, secret: false, required: true },
  { name: V.MODEL_ATTEMPTS, secret: false, required: true },
  { name: V.TOOL_CALL_TIMEOUT_MS, secret: false, required: true },
  { name: V.STORE_CALL_TIMEOUT_MS, secret: false, required: true },
  { name: V.REAPER_INTERVAL_MS, secret: false, required: true },
  { name: V.REAPER_BATCH_SIZE, secret: false, required: true },
  { name: V.STREAM_SWEEP_INTERVAL_MS, secret: false, required: true },
  { name: V.STREAM_SWEEP_BATCH_SIZE, secret: false, required: true },
  { name: V.REQUEST_PAGE_SIZE, secret: false, required: true },
  { name: V.WORKER_TOOLS_TOKEN, secret: true, required: true },
];

const EnvValue = z.union([z.string(), z.number()]);

const Worker = z.strictObject({
  name: z.string(),
  entry: z.string(),
  toolsUrl: z.url().optional(),
});

export const ServerConfig = z.strictObject({
  env: z.record(z.string(), EnvValue),
  workers: z.array(Worker),
});
export type ServerConfig = z.infer<typeof ServerConfig>;

/** `create` entries are dropped by `db delete`; `use` entries are only detached (D10). */
export const DatabaseOrigin = z.enum({ create: 'create', use: 'use' });
export type DatabaseOrigin = z.infer<typeof DatabaseOrigin>;

export const ServerSecrets = z.strictObject({
  env: z.record(z.string(), z.string()),
  databases: z.record(
    z.string(),
    z.strictObject({
      url: z.url(),
      /** Absent reads as `use`, so a drop never touches an entry the CLI did not create. */
      origin: DatabaseOrigin.default(DatabaseOrigin.enum.use),
    }),
  ),
  attached: z.string().optional(),
});
export type ServerSecrets = z.infer<typeof ServerSecrets>;

export interface ServerFiles {
  readonly config: ServerConfig;
  readonly secrets: ServerSecrets;
}

function isMissing(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === FsToken.enum.notFound
  );
}

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, FsToken.enum.utf8);
  } catch (cause) {
    if (isMissing(cause)) {
      throw new CliUsage(ServerMessage.enum.notInitialized);
    }
    throw cause;
  }
}

/** The messages never echo the file text (G6). */
function parseOrFail<S extends z.ZodType>(
  schema: S,
  decode: (text: string) => unknown,
  text: string,
  bad: string,
): z.output<S> {
  let raw: unknown;
  try {
    raw = decode(text);
  } catch {
    throw new CliFailure(bad);
  }
  const checked = schema.safeParse(raw);
  if (!checked.success) throw new CliFailure(bad);
  return checked.data;
}

export async function readServerFiles(
  projectDir: string,
): Promise<ServerFiles> {
  const config = parseOrFail(
    ServerConfig,
    parse,
    await readText(join(projectDir, ServerFile.enum.config)),
    ServerMessage.enum.configBad,
  );
  const secrets = parseOrFail(
    ServerSecrets,
    JSON.parse,
    await readText(
      join(projectDir, ServerFile.enum.secretsDir, ServerFile.enum.secretsFile),
    ),
    ServerMessage.enum.secretsBad,
  );
  return { config, secrets };
}

/** Writes to a temp file in the same directory, then renames it over the target. */
async function writeFileAtomic(
  file: string,
  text: string,
  mode: number,
): Promise<void> {
  const random = randomBytes(TEMP_RANDOM_BYTES).toString(FsToken.enum.hex);
  const temp = `${file}.${random}${FsToken.enum.tempSuffix}`;
  const handle = await open(temp, FsToken.enum.exclusiveWrite, mode);
  try {
    await handle.writeFile(text, FsToken.enum.utf8);
  } finally {
    await handle.close();
  }
  await rename(temp, file);
}

export async function writeServerFiles(
  projectDir: string,
  files: ServerFiles,
): Promise<void> {
  const secretsDir = join(projectDir, ServerFile.enum.secretsDir);
  await mkdir(secretsDir, { recursive: true, mode: SECRETS_DIR_MODE });
  await chmod(secretsDir, SECRETS_DIR_MODE);
  await writeFileAtomic(
    join(projectDir, ServerFile.enum.config),
    stringify(files.config),
    CONFIG_FILE_MODE,
  );
  await writeFileAtomic(
    join(secretsDir, ServerFile.enum.secretsFile),
    JSON.stringify(files.secrets),
    SECRETS_FILE_MODE,
  );
}

/** Both env maps as the child sees them. `attached` fills DATABASE_URL and wins (D10). */
export function childEnv(files: ServerFiles): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(files.config.env)) {
    env[name] = String(value);
  }
  Object.assign(env, files.secrets.env);
  if (files.secrets.attached !== undefined) {
    env[V.DATABASE_URL] = files.secrets.attached;
  }
  return env;
}

/** The desk gate (PD13): `dev`, `start`, `deploy`, `db`, and `migrate` call it first. */
export function requireDeskProject(projectDir: string): Promise<ServerFiles> {
  return readServerFiles(projectDir);
}

export function workerToolsToken(secrets: ServerSecrets): string {
  const token = secrets.env[V.WORKER_TOOLS_TOKEN];
  if (token === undefined || token.length === 0) {
    throw new CliUsage(ServerMessage.enum.tokenMissing);
  }
  return token;
}

/** Checks a database name before it reaches DDL (B7). */
export function databaseName(name: string): string {
  if (!DATABASE_NAME.test(name)) {
    throw new CliUsage(ServerMessage.enum.badDatabaseName);
  }
  return name;
}

/** The name as a Postgres identifier. Only a checked name has no quote to escape. */
export function quoteIdentifier(name: string): string {
  return `"${databaseName(name)}"`;
}

function parsedUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new CliUsage(ServerMessage.enum.badDatabaseUrl);
  }
}

/** The database a URL names: its path segment, held to the same rule as a created name (PD17). */
export function databaseNameOfUrl(url: string): string {
  return databaseName(parsedUrl(url).pathname.replace(URL_PATH_SLASH, ''));
}

/** The URL with its password replaced, for `db show` without `--show-secrets`. */
export function maskUrl(url: string): string {
  const parsed = parsedUrl(url);
  if (parsed.password !== '') parsed.password = MASKED_PASSWORD;
  return parsed.toString();
}
