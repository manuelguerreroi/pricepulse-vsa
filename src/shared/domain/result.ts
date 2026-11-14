/**
 * Standard Result / Either type for functional error handling in Vertical Slice Architecture.
 * Prevents throwing exceptions for expected domain and business outcomes.
 */

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
  readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  isOk(): this is Ok<T, E> {
    return true;
  }

  isErr(): this is Err<T, E> {
    return false;
  }
}

export class Err<T, E> {
  readonly error: E;

  constructor(error: E) {
    this.error = error;
  }

  isOk(): this is Ok<T, E> {
    return false;
  }

  isErr(): this is Err<T, E> {
    return true;
  }
}

export const Result = {
  ok<T, E = never>(value: T): Result<T, E> {
    return new Ok(value);
  },

  err<T = never, E = unknown>(error: E): Result<T, E> {
    return new Err(error);
  },
};
