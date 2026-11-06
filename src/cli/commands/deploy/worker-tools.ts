// B4: `ToolEntry` must stay aligned with `ToolEntryBody` in src/api/routes/tools/routes.ts; cli may not import api (L2).
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { z } from '../../../index.ts';
import { ENOENT } from '../../utils/constants.ts';
import { CliFailure, CliUsage } from '../../utils/failure.ts';
import { ServerFile } from '../../utils/server-config.ts';

const jsonObject = z.record(z.string(), z.unknown());
const positiveInt = z.number().int().min(1);

/** One catalog entry as a worker serves it on `GET /tools` and `createTool` takes it (PD8). */
export const ToolEntry = z.strictObject({
  key: z.string().min(1),
  implementationVersion: positiveInt,
  name: z.string().min(1),
  description: z.string(),
  inputSchema: jsonObject,
  retryOnInterrupt: z.boolean().optional(),
  toolAttempts: positiveInt.optional(),
  maxToolOutputBytes: positiveInt.optional(),
  approval: z.enum(['never_ask', 'low', 'medium', 'high']),
  configSchema: jsonObject.nullish(),
});
export type ToolEntry = z.infer<typeof ToolEntry>;

const DevWorkerSnapshot = z.strictObject({
  name: z.string().min(1),
  toolsUrl: z.url(),
  hash: z.string().min(1),
});
export type DevWorkerSnapshot = z.infer<typeof DevWorkerSnapshot>;

/** `.secrets/dev-state.json` (B5): a JSON array of snapshots. `dev` and `start` write it (PD9). */
export const DEV_STATE_FILE = 'dev-state.json';

const MANIFEST_EXTENSIONS: ReadonlySet<string> = new Set(['.yaml', '.yml']);

const WorkerText = z.enum({
  sha256: 'sha256',
  hex: 'hex',
  utf8: 'utf8',
  bearer: 'Bearer ',
  workerPrefix: 'worker ',
  unreachable: ': /tools is not reachable',
  refused: ': /tools answered ',
  badBody: ': /tools sent a bad entry list',
  stale:
    ': tools changed since dev or start last saw it ready; restart dev or start',
  devStateBad: 'the dev-state file is not valid',
  noPath: 'no such deploy path: ',
  noUrl: ': no toolsUrl in config.yaml and no dev-state row; run dev or start',
});

export interface WorkerTools {
  readonly name: string;
  readonly toolsUrl: string;
  readonly entries: readonly ToolEntry[];
  readonly hash: string;
}

/** Same value for the same JSON whatever the key order; array order counts. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, child]) => [key, canonical(child)]),
  );
}

/** SHA-256 hex of JSON with object keys sorted at every depth (D8). */
export function canonicalHash(value: unknown): string {
  return createHash(WorkerText.enum.sha256)
    .update(JSON.stringify(canonical(value)))
    .digest(WorkerText.enum.hex);
}

function workerFailure(name: string, reason: string): CliFailure {
  return new CliFailure(`${WorkerText.enum.workerPrefix}${name}${reason}`);
}

/** `GET <toolsUrl>` with the bearer in a header only. No message carries the token (PD8, G6). */
export async function readWorkerTools(
  fetchFn: typeof fetch,
  worker: { readonly name: string; readonly toolsUrl: string },
  token: string,
): Promise<WorkerTools> {
  let response: Response;
  try {
    response = await fetchFn(worker.toolsUrl, {
      headers: { authorization: `${WorkerText.enum.bearer}${token}` },
    });
  } catch {
    throw workerFailure(worker.name, WorkerText.enum.unreachable);
  }
  if (!response.ok) {
    throw workerFailure(
      worker.name,
      `${WorkerText.enum.refused}${String(response.status)}`,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw workerFailure(worker.name, WorkerText.enum.badBody);
  }
  const entries = z.array(ToolEntry).safeParse(body);
  if (!entries.success)
    throw workerFailure(worker.name, WorkerText.enum.badBody);
  return {
    name: worker.name,
    toolsUrl: worker.toolsUrl,
    entries: entries.data,
    hash: canonicalHash(body),
  };
}

function isMissing(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === ENOENT
  );
}

/** The snapshots `dev` or `start` recorded. No file means no snapshot yet. */
export async function readDevState(
  projectDir: string,
): Promise<readonly DevWorkerSnapshot[]> {
  let text: string;
  try {
    text = await readFile(
      join(projectDir, ServerFile.enum.secretsDir, DEV_STATE_FILE),
      WorkerText.enum.utf8,
    );
  } catch (cause) {
    if (isMissing(cause)) return [];
    throw cause;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new CliFailure(WorkerText.enum.devStateBad);
  }
  const rows = z.array(DevWorkerSnapshot).safeParse(raw);
  if (!rows.success) throw new CliFailure(WorkerText.enum.devStateBad);
  return rows.data;
}

/** Each config worker's `/tools` URL: the one `dev` or `start` recorded at ready, else config.yaml's (D8). */
export function workerSources(
  workers: readonly {
    readonly name: string;
    readonly toolsUrl?: string | undefined;
  }[],
  snapshots: readonly DevWorkerSnapshot[],
): readonly { readonly name: string; readonly toolsUrl: string }[] {
  return workers.map((worker) => {
    const toolsUrl =
      snapshots.find((row) => row.name === worker.name)?.toolsUrl ??
      worker.toolsUrl;
    if (toolsUrl === undefined) {
      throw workerFailure(worker.name, WorkerText.enum.noUrl);
    }
    return { name: worker.name, toolsUrl };
  });
}

/** A hash mismatch fails naming the worker; with no snapshot there is nothing to compare (D8). */
export function assertWorkerToolsFresh(
  live: WorkerTools,
  snapshot: DevWorkerSnapshot | undefined,
): void {
  if (snapshot === undefined || snapshot.hash === live.hash) return;
  throw workerFailure(live.name, WorkerText.enum.stale);
}

/** `deploy <path>`: the file itself, or each `*.yaml` / `*.yml` file directly in the directory, lexical order (PD7). */
export async function deployFiles(path: string): Promise<readonly string[]> {
  let isDirectory: boolean;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch (cause) {
    if (isMissing(cause))
      throw new CliUsage(`${WorkerText.enum.noPath}${path}`);
    throw cause;
  }
  if (!isDirectory) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  return entries
    .filter(
      (entry) => entry.isFile() && MANIFEST_EXTENSIONS.has(extname(entry.name)),
    )
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(path, name));
}
