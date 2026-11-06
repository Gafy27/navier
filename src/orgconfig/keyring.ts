import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { readKeyFile } from './keyfile.ts';
import { sealWithAad, unsealWithAad } from './seal.ts';
import type { Sealed } from './seal.ts';

const aadBytes = (aad: readonly string[]) => Buffer.from(JSON.stringify(aad));

/** Seals with the current key of `SECRETS_KEYS_FILE`, bound to `aad`. */
export function sealWithKeyring(
  plaintext: string,
  aad: readonly string[],
): Result<Sealed> {
  const file = readKeyFile();
  if (!file.ok) return file;
  const { current, keys } = file.value;
  const wrappingKey = keys[current];
  if (wrappingKey === undefined) {
    return err(
      appError(ErrorCode.invalid_argument, 'SECRETS_KEYS_FILE: invalid'),
    );
  }
  return ok(sealWithAad(plaintext, aadBytes(aad), current, wrappingKey));
}

/** Opens with the key the value names. Every failure is the same message. */
export function unsealWithKeyring(
  sealed: Sealed,
  aad: readonly string[],
): Result<string> {
  const file = readKeyFile();
  if (!file.ok) return file;
  const wrappingKey = file.value.keys[sealed.keyId];
  if (wrappingKey === undefined) {
    return err(appError(ErrorCode.internal, 'key cannot be opened'));
  }
  return unsealWithAad(sealed, aadBytes(aad), wrappingKey);
}
