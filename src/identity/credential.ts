import { inspect } from 'node:util';
import { REDACTED } from '../index.ts';

/** Holds a bearer token. It prints, serializes, and inspects as `[REDACTED]`; only `reveal` returns it. */
export class Credential {
  readonly #token: string;

  constructor(token: string) {
    this.#token = token;
  }

  reveal(): string {
    return this.#token;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}

export function createCredential(token: string): Credential {
  return new Credential(token);
}
