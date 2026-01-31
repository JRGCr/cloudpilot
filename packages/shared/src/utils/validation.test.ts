import { describe, expect, it } from 'vitest';
import { isErr, isOk } from './result.js';
import {
  url,
  and,
  array,
  boolean,
  email,
  integer,
  isoDate,
  length,
  maxLength,
  minLength,
  nonEmptyString,
  nullable,
  number,
  object,
  oneOf,
  optional,
  or,
  pattern,
  range,
  string,
  uuid,
} from './validation.js';

describe('Validation utilities', () => {
  describe('Primitive validators', () => {
    describe('string', () => {
      it('accepts valid strings', () => {
        const result = string()('hello');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toBe('hello');
      });

      it('accepts empty strings', () => {
        const result = string()('');
        expect(isOk(result)).toBe(true);
      });

      it('rejects non-strings', () => {
        expect(isErr(string()(123))).toBe(true);
        expect(isErr(string()(null))).toBe(true);
        expect(isErr(string()(undefined))).toBe(true);
        expect(isErr(string()(true))).toBe(true);
      });

      it('includes field name in error', () => {
        const result = string()(123, 'username');
        if (isErr(result)) {
          expect(result.error.field).toBe('username');
          expect(result.error.code).toBe('INVALID_TYPE');
        }
      });
    });

    describe('nonEmptyString', () => {
      it('accepts non-empty strings', () => {
        const result = nonEmptyString()('hello');
        expect(isOk(result)).toBe(true);
      });

      it('rejects empty strings', () => {
        const result = nonEmptyString()('');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('EMPTY_STRING');
      });

      it('rejects whitespace-only strings', () => {
        const result = nonEmptyString()('   ');
        expect(isErr(result)).toBe(true);
      });

      it('rejects non-strings', () => {
        expect(isErr(nonEmptyString()(123))).toBe(true);
      });
    });

    describe('number', () => {
      it('accepts valid numbers', () => {
        expect(isOk(number()(42))).toBe(true);
        expect(isOk(number()(3.14))).toBe(true);
        expect(isOk(number()(-10))).toBe(true);
        expect(isOk(number()(0))).toBe(true);
      });

      it('rejects NaN', () => {
        expect(isErr(number()(Number.NaN))).toBe(true);
      });

      it('rejects non-numbers', () => {
        expect(isErr(number()('42'))).toBe(true);
        expect(isErr(number()(null))).toBe(true);
      });
    });

    describe('integer', () => {
      it('accepts integers', () => {
        expect(isOk(integer()(42))).toBe(true);
        expect(isOk(integer()(0))).toBe(true);
        expect(isOk(integer()(-10))).toBe(true);
      });

      it('rejects non-integers', () => {
        const result = integer()(3.14);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('NOT_INTEGER');
      });

      it('rejects non-numbers', () => {
        expect(isErr(integer()('42'))).toBe(true);
      });
    });

    describe('boolean', () => {
      it('accepts booleans', () => {
        expect(isOk(boolean()(true))).toBe(true);
        expect(isOk(boolean()(false))).toBe(true);
      });

      it('rejects non-booleans', () => {
        expect(isErr(boolean()(1))).toBe(true);
        expect(isErr(boolean()('true'))).toBe(true);
        expect(isErr(boolean()(null))).toBe(true);
      });
    });
  });

  describe('Format validators', () => {
    describe('email', () => {
      it('accepts valid emails', () => {
        expect(isOk(email()('user@example.com'))).toBe(true);
        expect(isOk(email()('test.user+tag@domain.co.uk'))).toBe(true);
      });

      it('rejects invalid emails', () => {
        expect(isErr(email()('invalid'))).toBe(true);
        expect(isErr(email()('missing@domain'))).toBe(true);
        expect(isErr(email()('@nodomain.com'))).toBe(true);
        expect(isErr(email()('spaces in@email.com'))).toBe(true);
      });

      it('includes proper error code', () => {
        const result = email()('invalid');
        if (isErr(result)) expect(result.error.code).toBe('INVALID_EMAIL');
      });
    });

    describe('uuid', () => {
      it('accepts valid UUIDs', () => {
        expect(isOk(uuid()('550e8400-e29b-41d4-a716-446655440000'))).toBe(true);
        expect(isOk(uuid()('6ba7b810-9dad-41d4-80b4-00c04fd430c8'))).toBe(true);
      });

      it('rejects invalid UUIDs', () => {
        expect(isErr(uuid()('not-a-uuid'))).toBe(true);
        expect(isErr(uuid()('550e8400-e29b-51d4-a716-446655440000'))).toBe(true); // wrong version
      });
    });

    describe('url', () => {
      it('accepts valid URLs', () => {
        expect(isOk(url()('https://example.com'))).toBe(true);
        expect(isOk(url()('http://localhost:3000/path?query=1'))).toBe(true);
      });

      it('rejects invalid URLs', () => {
        expect(isErr(url()('not-a-url'))).toBe(true);
        expect(isErr(url()('example.com'))).toBe(true);
      });
    });

    describe('isoDate', () => {
      it('accepts valid ISO dates', () => {
        expect(isOk(isoDate()('2024-01-15'))).toBe(true);
        expect(isOk(isoDate()('2024-01-15T10:30:00.000Z'))).toBe(true);
      });

      it('rejects invalid dates', () => {
        expect(isErr(isoDate()('not-a-date'))).toBe(true);
        expect(isErr(isoDate()('32/01/2024'))).toBe(true);
      });
    });
  });

  describe('Constraint validators', () => {
    describe('minLength', () => {
      it('accepts strings meeting minimum', () => {
        expect(isOk(minLength(3)('abc'))).toBe(true);
        expect(isOk(minLength(3)('abcd'))).toBe(true);
      });

      it('rejects strings below minimum', () => {
        const result = minLength(3)('ab');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('TOO_SHORT');
      });

      it('works with arrays', () => {
        expect(isOk(minLength(2)([1, 2, 3]))).toBe(true);
        expect(isErr(minLength(2)([1]))).toBe(true);
      });
    });

    describe('maxLength', () => {
      it('accepts strings within maximum', () => {
        expect(isOk(maxLength(5)('abc'))).toBe(true);
        expect(isOk(maxLength(5)('abcde'))).toBe(true);
      });

      it('rejects strings exceeding maximum', () => {
        const result = maxLength(5)('abcdef');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('TOO_LONG');
      });

      it('works with arrays', () => {
        expect(isOk(maxLength(3)([1, 2]))).toBe(true);
        expect(isErr(maxLength(3)([1, 2, 3, 4]))).toBe(true);
      });
    });

    describe('length', () => {
      it('accepts exact length', () => {
        expect(isOk(length(3)('abc'))).toBe(true);
        expect(isOk(length(3)([1, 2, 3]))).toBe(true);
      });

      it('rejects different lengths', () => {
        expect(isErr(length(3)('ab'))).toBe(true);
        expect(isErr(length(3)('abcd'))).toBe(true);
      });
    });

    describe('range', () => {
      it('accepts numbers in range', () => {
        expect(isOk(range(1, 10)(5))).toBe(true);
        expect(isOk(range(1, 10)(1))).toBe(true);
        expect(isOk(range(1, 10)(10))).toBe(true);
      });

      it('rejects numbers outside range', () => {
        expect(isErr(range(1, 10)(0))).toBe(true);
        expect(isErr(range(1, 10)(11))).toBe(true);
      });
    });

    describe('pattern', () => {
      it('accepts matching strings', () => {
        expect(isOk(pattern(/^[A-Z]+$/)('ABC'))).toBe(true);
      });

      it('rejects non-matching strings', () => {
        const result = pattern(/^[A-Z]+$/)('abc');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('PATTERN_MISMATCH');
      });
    });

    describe('oneOf', () => {
      it('accepts valid options', () => {
        const validator = oneOf(['a', 'b', 'c'] as const);
        expect(isOk(validator('a'))).toBe(true);
        expect(isOk(validator('b'))).toBe(true);
      });

      it('rejects invalid options', () => {
        const validator = oneOf(['a', 'b', 'c'] as const);
        const result = validator('d');
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.code).toBe('INVALID_OPTION');
      });

      it('works with numbers', () => {
        const validator = oneOf([1, 2, 3] as const);
        expect(isOk(validator(1))).toBe(true);
        expect(isErr(validator(4))).toBe(true);
      });
    });
  });

  describe('Combinators', () => {
    describe('optional', () => {
      it('accepts undefined', () => {
        const result = optional(string())(undefined);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toBe(undefined);
      });

      it('validates non-undefined values', () => {
        expect(isOk(optional(string())('hello'))).toBe(true);
        expect(isErr(optional(string())(123))).toBe(true);
      });
    });

    describe('nullable', () => {
      it('accepts null', () => {
        const result = nullable(string())(null);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toBe(null);
      });

      it('validates non-null values', () => {
        expect(isOk(nullable(string())('hello'))).toBe(true);
        expect(isErr(nullable(string())(123))).toBe(true);
      });
    });

    describe('array', () => {
      it('accepts valid arrays', () => {
        const result = array(number())([1, 2, 3]);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) expect(result.value).toEqual([1, 2, 3]);
      });

      it('rejects invalid items', () => {
        const result = array(number())([1, 'two', 3]);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.field).toBe('value[1]');
      });

      it('rejects non-arrays', () => {
        expect(isErr(array(number())('not an array'))).toBe(true);
      });

      it('accepts empty arrays', () => {
        expect(isOk(array(number())([]))).toBe(true);
      });
    });

    describe('object', () => {
      it('validates object schemas', () => {
        const validator = object({
          name: nonEmptyString(),
          age: integer(),
        });

        const result = validator({ name: 'John', age: 30 });
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual({ name: 'John', age: 30 });
        }
      });

      it('rejects invalid fields', () => {
        const validator = object({
          name: nonEmptyString(),
          age: integer(),
        });

        const result = validator({ name: '', age: 30 });
        expect(isErr(result)).toBe(true);
        if (isErr(result)) expect(result.error.field).toBe('value.name');
      });

      it('rejects non-objects', () => {
        const validator = object({ name: string() });
        expect(isErr(validator('not an object'))).toBe(true);
        expect(isErr(validator(null))).toBe(true);
      });
    });

    describe('and', () => {
      it('chains validators', () => {
        const validator = and(string(), minLength(3));
        expect(isOk(validator('hello'))).toBe(true);
        expect(isErr(validator('hi'))).toBe(true);
        expect(isErr(validator(123))).toBe(true);
      });
    });

    describe('or', () => {
      it('accepts first validator match', () => {
        const validator = or(string(), number());
        expect(isOk(validator('hello'))).toBe(true);
      });

      it('falls back to second validator', () => {
        const validator = or(string(), number());
        expect(isOk(validator(42))).toBe(true);
      });

      it('rejects if both fail', () => {
        const validator = or(string(), number());
        expect(isErr(validator(true))).toBe(true);
      });
    });
  });

  describe('Nested validation', () => {
    it('validates complex nested structures', () => {
      const userValidator = object({
        id: uuid(),
        email: email(),
        profile: object({
          name: nonEmptyString(),
          age: optional(integer()),
        }),
        roles: array(oneOf(['admin', 'user', 'guest'] as const)),
      });

      const validUser = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        profile: {
          name: 'John Doe',
          age: 30,
        },
        roles: ['admin', 'user'],
      };

      const result = userValidator(validUser);
      expect(isOk(result)).toBe(true);
    });

    it('reports nested field errors correctly', () => {
      const userValidator = object({
        profile: object({
          name: nonEmptyString(),
        }),
      });

      const result = userValidator({ profile: { name: '' } });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.field).toBe('value.profile.name');
      }
    });
  });
});
