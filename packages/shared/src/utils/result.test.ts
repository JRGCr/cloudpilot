import { describe, expect, it } from 'vitest';
import {
  combine,
  combineObject,
  err,
  flatMap,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  tryCatch,
  tryCatchAsync,
  unwrap,
  unwrapOr,
  unwrapOrElse,
} from './result.js';

describe('Result type', () => {
  describe('constructors', () => {
    it('ok creates Ok result', () => {
      const result = ok(42);
      expect(result._tag).toBe('Ok');
      expect(result.value).toBe(42);
    });

    it('err creates Err result', () => {
      const result = err('error');
      expect(result._tag).toBe('Err');
      expect(result.error).toBe('error');
    });
  });

  describe('type guards', () => {
    it('isOk returns true for Ok', () => {
      expect(isOk(ok(42))).toBe(true);
      expect(isOk(err('error'))).toBe(false);
    });

    it('isErr returns true for Err', () => {
      expect(isErr(err('error'))).toBe(true);
      expect(isErr(ok(42))).toBe(false);
    });
  });

  describe('transformations', () => {
    it('map transforms Ok value', () => {
      const result = map(ok(2), (x) => x * 2);
      expect(isOk(result) && result.value).toBe(4);
    });

    it('map passes through Err', () => {
      const result = map(err('error'), (x: number) => x * 2);
      expect(isErr(result) && result.error).toBe('error');
    });

    it('mapErr transforms Err error', () => {
      const result = mapErr(err('error'), (e) => e.toUpperCase());
      expect(isErr(result) && result.error).toBe('ERROR');
    });

    it('mapErr passes through Ok', () => {
      const result = mapErr(ok(42), (e: string) => e.toUpperCase());
      expect(isOk(result) && result.value).toBe(42);
    });

    it('flatMap chains Ok results', () => {
      const result = flatMap(ok(2), (x) => ok(x * 2));
      expect(isOk(result) && result.value).toBe(4);
    });

    it('flatMap short-circuits on Err', () => {
      const result = flatMap(err('error'), (x: number) => ok(x * 2));
      expect(isErr(result) && result.error).toBe('error');
    });
  });

  describe('unwrapping', () => {
    it('unwrap returns Ok value', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('unwrap throws Err error', () => {
      expect(() => unwrap(err('error'))).toThrow('error');
    });

    it('unwrapOr returns Ok value', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('unwrapOr returns default for Err', () => {
      expect(unwrapOr(err('error'), 0)).toBe(0);
    });

    it('unwrapOrElse returns Ok value', () => {
      expect(unwrapOrElse(ok(42), () => 0)).toBe(42);
    });

    it('unwrapOrElse calls fn for Err', () => {
      expect(unwrapOrElse(err('error'), (e) => e.length)).toBe(5);
    });
  });

  describe('tryCatch', () => {
    it('tryCatch returns Ok on success', () => {
      const result = tryCatch(() => 42);
      expect(isOk(result) && result.value).toBe(42);
    });

    it('tryCatch returns Err on throw', () => {
      const result = tryCatch(() => {
        throw new Error('fail');
      });
      expect(isErr(result) && result.error.message).toBe('fail');
    });

    it('tryCatchAsync returns Ok on success', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(isOk(result) && result.value).toBe(42);
    });

    it('tryCatchAsync returns Err on rejection', async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error('fail');
      });
      expect(isErr(result) && result.error.message).toBe('fail');
    });
  });

  describe('combinators', () => {
    it('combine returns Ok array when all Ok', () => {
      const result = combine([ok(1), ok(2), ok(3)]);
      expect(isOk(result) && result.value).toEqual([1, 2, 3]);
    });

    it('combine returns first Err', () => {
      const result = combine([ok(1), err('error'), ok(3)]);
      expect(isErr(result) && result.error).toBe('error');
    });

    it('combineObject returns Ok object when all Ok', () => {
      const result = combineObject({
        a: ok(1),
        b: ok('two'),
      });
      expect(isOk(result) && result.value).toEqual({ a: 1, b: 'two' });
    });

    it('combineObject returns first Err', () => {
      const result = combineObject({
        a: ok(1),
        b: err('error'),
      });
      expect(isErr(result) && result.error).toBe('error');
    });
  });

  describe('match', () => {
    it('match calls ok handler for Ok', () => {
      const result = match(ok(42), {
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe('value: 42');
    });

    it('match calls err handler for Err', () => {
      const result = match(err('fail'), {
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe('error: fail');
    });
  });
});
