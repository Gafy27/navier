import { readFileSync } from 'node:fs';
import { appError, err, ErrorCode, loadConfig, ok, z } from '../index.ts';
import type { Result } from '../index.ts';

const KEY_BYTES = 32;

const WrappingKey = z
  .base64()
  .transform((text) => Buffer.from(text, 'base64'))
  .refine((key) => key.length === KEY_BYTES);

const KeyFileSchema = z
  .strictObject({
    current: z.string().min(1),
    keys: z.record(z.string().min(1), WrappingKey),
  })
  .refine((file) => file.current in file.keys);

const EnvSchema = z.object({ SECRETS_KEYS_FILE: z.string().min(1) });

export type KeyFile = z.output<typeof KeyFileSchema>;

const failed = (message: string) =>
  err(appError(ErrorCode.invalid_argument, message));

/** Reads `SECRETS_KEYS_FILE`. A message names the variable, never a key. */
export function readKeyFile(): Result<KeyFile> {
  // The key file path is the only input; callers hold nothing from the file.
  // eslint-disable-next-line no-restricted-syntax
  const env = loadConfig(EnvSchema, process.env);
  if (!env.ok) return env;
  let text: string;
  try {
    text = readFileSync(env.value.SECRETS_KEYS_FILE, 'utf8');
  } catch {
    return failed('SECRETS_KEYS_FILE: unreadable');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return failed('SECRETS_KEYS_FILE: invalid');
  }
  const parsed = KeyFileSchema.safeParse(json);
  if (!parsed.success) return failed('SECRETS_KEYS_FILE: invalid');
  return ok(parsed.data);
}

/** Opens the key file once. Callers store nothing from it. */
export function requireKeyFile(): Result<void> {
  const file = readKeyFile();
  if (!file.ok) return file;
  return ok(undefined);
}
