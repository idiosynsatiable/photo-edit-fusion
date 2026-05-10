/**
 * Lightweight Result type used across the codebase to avoid throwing in hot
 * paths. Errors are represented explicitly so callers must handle them.
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error instanceof Error ? r.error : new Error(String(r.error));
}

export function map<T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return r.ok ? Ok(fn(r.value)) : r;
}

export function mapErr<T, E, F>(r: Result<T, E>, fn: (e: E) => F): Result<T, F> {
  return r.ok ? r : Err(fn(r.error));
}
