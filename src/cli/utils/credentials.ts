import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from '../../index.ts';
import {
  CREDENTIALS_DIR_MODE,
  CREDENTIALS_FILE_MODE,
  CREDENTIALS_FILE_NAME,
  CREDENTIALS_GROUP_OTHER_MASK,
  CREDENTIALS_TEMP_PREFIX,
  CREDENTIALS_TEMP_RANDOM_BYTES,
  CREDENTIALS_TEMP_SUFFIX,
  CREDENTIALS_TEXT_ENCODING,
  ENOENT,
} from './constants.ts';
import {
  CREDENTIALS_BAD_SHAPE,
  CREDENTIALS_MODE_TOO_OPEN,
  CREDENTIALS_NOT_JSON,
  CREDENTIALS_WRITE_BAD_SHAPE,
} from './copy.ts';
import { CliFailure } from './failure.ts';

export const AuthKind = z.enum({ person: 'person', service: 'service' });
export type AuthKind = z.infer<typeof AuthKind>;

const PersonAuth = z.strictObject({
  kind: z.literal(AuthKind.enum.person),
  session: z.string().min(1),
});

export const ServiceAuth = z.strictObject({
  kind: z.literal(AuthKind.enum.service),
  issuer: z.url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export const Auth = z.discriminatedUnion('kind', [PersonAuth, ServiceAuth]);
export type Auth = z.infer<typeof Auth>;

export const Credentials = z.strictObject({
  baseUrl: z.url(),
  auth: Auth,
  org: z.string().optional(),
  space: z.string().optional(),
});
export type Credentials = z.infer<typeof Credentials>;

export interface CredentialsStore {
  /** `undefined` when the file is absent. Throws `CliFailure` on a mode too open or a bad shape. */
  readonly read: () => Promise<Credentials | undefined>;
  /** Replaces the whole file (PD4). */
  readonly write: (credentials: Credentials) => Promise<void>;
  readonly remove: () => Promise<void>;
}

async function openIfPresent(file: string): Promise<FileHandle | undefined> {
  try {
    return await open(file, 'r');
  } catch (cause) {
    if (typeof cause === 'object' && cause !== null && 'code' in cause) {
      if (cause.code === ENOENT) return undefined;
    }
    throw cause;
  }
}

/** Parses the file text. The messages never echo the text (G6). */
function parseCredentials(text: string): Credentials {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CliFailure(CREDENTIALS_NOT_JSON);
  }
  const parsed = Credentials.safeParse(json);
  if (!parsed.success) throw new CliFailure(CREDENTIALS_BAD_SHAPE);
  return parsed.data;
}

/** Reads and writes `<dir>/credentials.json` and nothing else (PD4). */
export function createCredentialsStore(dir: string): CredentialsStore {
  const file = join(dir, CREDENTIALS_FILE_NAME);
  return {
    read: async () => {
      const handle = await openIfPresent(file);
      if (handle === undefined) return undefined;
      try {
        const { mode } = await handle.stat();
        if ((mode & CREDENTIALS_GROUP_OTHER_MASK) !== 0) {
          throw new CliFailure(CREDENTIALS_MODE_TOO_OPEN);
        }
        return parseCredentials(
          await handle.readFile({ encoding: CREDENTIALS_TEXT_ENCODING }),
        );
      } finally {
        await handle.close();
      }
    },
    write: async (credentials) => {
      const checked = Credentials.safeParse(credentials);
      if (!checked.success) {
        throw new CliFailure(CREDENTIALS_WRITE_BAD_SHAPE);
      }
      await mkdir(dir, { recursive: true, mode: CREDENTIALS_DIR_MODE });
      const temp = join(
        dir,
        `${CREDENTIALS_TEMP_PREFIX}${randomBytes(CREDENTIALS_TEMP_RANDOM_BYTES).toString('hex')}${CREDENTIALS_TEMP_SUFFIX}`,
      );
      const handle = await open(temp, 'wx', CREDENTIALS_FILE_MODE);
      try {
        await handle.writeFile(JSON.stringify(checked.data));
      } catch (cause) {
        await rm(temp, { force: true });
        throw cause;
      } finally {
        await handle.close();
      }
      await rename(temp, file);
    },
    remove: () => rm(file, { force: true }),
  };
}
