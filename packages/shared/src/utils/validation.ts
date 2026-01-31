/**
 * Composable validation utilities that return Result types
 */

import { type Result, err, isErr, ok } from './result.js';

export type ValidationError = {
  field: string;
  message: string;
  code: string;
};

export type Validator<T> = (value: unknown, field?: string) => Result<T, ValidationError>;

// Helper to create validation errors
function validationError(field: string, message: string, code: string): ValidationError {
  return { field, message, code };
}

// Primitive Validators

export function string(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    return ok(value);
  };
}

export function nonEmptyString(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    if (value.trim().length === 0) {
      return err(validationError(field, 'String cannot be empty', 'EMPTY_STRING'));
    }
    return ok(value);
  };
}

export function number(): Validator<number> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return err(validationError(field, 'Expected a number', 'INVALID_TYPE'));
    }
    return ok(value);
  };
}

export function integer(): Validator<number> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return err(validationError(field, 'Expected a number', 'INVALID_TYPE'));
    }
    if (!Number.isInteger(value)) {
      return err(validationError(field, 'Expected an integer', 'NOT_INTEGER'));
    }
    return ok(value);
  };
}

export function boolean(): Validator<boolean> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'boolean') {
      return err(validationError(field, 'Expected a boolean', 'INVALID_TYPE'));
    }
    return ok(value);
  };
}

// Format Validators

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function email(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    if (!EMAIL_REGEX.test(value)) {
      return err(validationError(field, 'Invalid email format', 'INVALID_EMAIL'));
    }
    return ok(value);
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuid(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    if (!UUID_REGEX.test(value)) {
      return err(validationError(field, 'Invalid UUID format', 'INVALID_UUID'));
    }
    return ok(value);
  };
}

export function url(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    try {
      new URL(value);
      return ok(value);
    } catch {
      return err(validationError(field, 'Invalid URL format', 'INVALID_URL'));
    }
  };
}

export function isoDate(): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    if (Number.isNaN(Date.parse(value))) {
      return err(validationError(field, 'Invalid date format', 'INVALID_DATE'));
    }
    return ok(value);
  };
}

// Constraint Validators

export function minLength(n: number): Validator<string | unknown[]> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return err(validationError(field, 'Expected a string or array', 'INVALID_TYPE'));
    }
    if (value.length < n) {
      return err(validationError(field, `Minimum length is ${n}`, 'TOO_SHORT'));
    }
    return ok(value);
  };
}

export function maxLength(n: number): Validator<string | unknown[]> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return err(validationError(field, 'Expected a string or array', 'INVALID_TYPE'));
    }
    if (value.length > n) {
      return err(validationError(field, `Maximum length is ${n}`, 'TOO_LONG'));
    }
    return ok(value);
  };
}

export function length(n: number): Validator<string | unknown[]> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return err(validationError(field, 'Expected a string or array', 'INVALID_TYPE'));
    }
    if (value.length !== n) {
      return err(validationError(field, `Expected length ${n}`, 'INVALID_LENGTH'));
    }
    return ok(value);
  };
}

export function range(min: number, max: number): Validator<number> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return err(validationError(field, 'Expected a number', 'INVALID_TYPE'));
    }
    if (value < min || value > max) {
      return err(validationError(field, `Value must be between ${min} and ${max}`, 'OUT_OF_RANGE'));
    }
    return ok(value);
  };
}

export function pattern(regex: RegExp): Validator<string> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'string') {
      return err(validationError(field, 'Expected a string', 'INVALID_TYPE'));
    }
    if (!regex.test(value)) {
      return err(validationError(field, 'Value does not match pattern', 'PATTERN_MISMATCH'));
    }
    return ok(value);
  };
}

export function oneOf<T extends string | number | boolean>(values: readonly T[]): Validator<T> {
  return (value: unknown, field = 'value') => {
    if (!values.includes(value as T)) {
      return err(
        validationError(field, `Value must be one of: ${values.join(', ')}`, 'INVALID_OPTION'),
      );
    }
    return ok(value as T);
  };
}

// Combinators

export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value: unknown, field = 'value') => {
    if (value === undefined) {
      return ok(undefined);
    }
    return validator(value, field);
  };
}

export function nullable<T>(validator: Validator<T>): Validator<T | null> {
  return (value: unknown, field = 'value') => {
    if (value === null) {
      return ok(null);
    }
    return validator(value, field);
  };
}

export function array<T>(itemValidator: Validator<T>): Validator<T[]> {
  return (value: unknown, field = 'value') => {
    if (!Array.isArray(value)) {
      return err(validationError(field, 'Expected an array', 'INVALID_TYPE'));
    }

    const results: T[] = [];
    for (let i = 0; i < value.length; i++) {
      const result = itemValidator(value[i], `${field}[${i}]`);
      if (isErr(result)) {
        return result;
      }
      results.push(result.value);
    }

    return ok(results);
  };
}

export function object<T extends Record<string, unknown>>(
  schema: {
    [K in keyof T]: Validator<T[K]>;
  },
): Validator<T> {
  return (value: unknown, field = 'value') => {
    if (typeof value !== 'object' || value === null) {
      return err(validationError(field, 'Expected an object', 'INVALID_TYPE'));
    }

    const result: Partial<T> = {};
    const obj = value as Record<string, unknown>;

    for (const key of Object.keys(schema) as Array<keyof T>) {
      const validator = schema[key];
      const fieldResult = validator(obj[key as string], `${field}.${String(key)}`);
      if (isErr(fieldResult)) {
        return fieldResult;
      }
      result[key] = fieldResult.value;
    }

    return ok(result as T);
  };
}

export function and<T>(v1: Validator<T>, v2: Validator<T>): Validator<T> {
  return (value: unknown, field = 'value') => {
    const r1 = v1(value, field);
    if (isErr(r1)) {
      return r1;
    }
    return v2(r1.value, field);
  };
}

export function or<T, U>(v1: Validator<T>, v2: Validator<U>): Validator<T | U> {
  return (value: unknown, field = 'value') => {
    const r1 = v1(value, field);
    if (!isErr(r1)) {
      return r1;
    }
    return v2(value, field);
  };
}
