import type { AppError } from './errors.ts';

/** Success carrying a value, or failure carrying an error. Every expected failure is a `Result`. */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Builds a success. Assignable to any `Result<T, E>`. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Builds a failure. Assignable to any `Result<T, E>`. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
