import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const DATA_KEY_BYTES = 32;

/** The columns of a sealed key row. */
export interface Sealed {
  readonly keyId: string;
  readonly wrappedKey: Buffer;
  readonly wrapNonce: Buffer;
  readonly dataNonce: Buffer;
  readonly ciphertext: Buffer;
}

/** Binds a sealed value to its row: a copy to another row does not open. */
export interface SealPlace {
  readonly org: string;
  readonly provider: string;
  readonly seq: number;
}

const aadOf = (place: SealPlace) =>
  Buffer.from(JSON.stringify([place.org, place.provider, place.seq]));

function encrypt(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer,
  plaintext: Buffer,
): Buffer {
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(aad);
  return Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

function decrypt(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer,
  sealed: Buffer,
): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - TAG_BYTES)),
    decipher.final(),
  ]);
}

/** A random data key seals the plaintext; the wrapping key seals the data key. */
export function sealWithAad(
  plaintext: string,
  aad: Buffer,
  keyId: string,
  wrappingKey: Buffer,
): Sealed {
  const dataKey = randomBytes(DATA_KEY_BYTES);
  const dataNonce = randomBytes(NONCE_BYTES);
  const wrapNonce = randomBytes(NONCE_BYTES);
  return {
    keyId,
    wrappedKey: encrypt(wrappingKey, wrapNonce, aad, dataKey),
    wrapNonce,
    dataNonce,
    ciphertext: encrypt(dataKey, dataNonce, aad, Buffer.from(plaintext)),
  };
}

const unopened = () =>
  err(appError(ErrorCode.internal, 'key cannot be opened'));

/** Every failure is the same message. It names no column. */
export function unsealWithAad(
  sealed: Sealed,
  aad: Buffer,
  wrappingKey: Buffer,
): Result<string> {
  try {
    const dataKey = decrypt(
      wrappingKey,
      sealed.wrapNonce,
      aad,
      sealed.wrappedKey,
    );
    return ok(
      decrypt(dataKey, sealed.dataNonce, aad, sealed.ciphertext).toString(
        'utf8',
      ),
    );
  } catch {
    return unopened();
  }
}

export function seal(
  plaintext: string,
  place: SealPlace,
  keyId: string,
  wrappingKey: Buffer,
): Sealed {
  return sealWithAad(plaintext, aadOf(place), keyId, wrappingKey);
}

export function unseal(
  sealed: Sealed,
  place: SealPlace,
  wrappingKeys: Readonly<Record<string, Buffer>>,
): Result<string> {
  const wrappingKey = wrappingKeys[sealed.keyId];
  if (wrappingKey === undefined) return unopened();
  return unsealWithAad(sealed, aadOf(place), wrappingKey);
}
