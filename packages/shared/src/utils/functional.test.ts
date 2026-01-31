import { describe, expect, it, vi } from 'vitest';
import {
  chunk,
  compose,
  constant,
  debounce,
  groupBy,
  identity,
  keyBy,
  memoize,
  memoizeWithTTL,
  partition,
  pipe,
  pipeAsync,
  throttle,
  uniqBy,
} from './functional.js';

describe('Functional utilities', () => {
  describe('pipe', () => {
    it('applies functions left to right', () => {
      const result = pipe(
        2,
        (x) => x + 1,
        (x) => x * 2,
      );
      expect(result).toBe(6);
    });

    it('returns initial value with no functions', () => {
      expect(pipe(42)).toBe(42);
    });
  });

  describe('pipeAsync', () => {
    it('handles async functions', async () => {
      const result = await pipeAsync(
        2,
        async (x) => x + 1,
        (x) => x * 2,
      );
      expect(result).toBe(6);
    });
  });

  describe('compose', () => {
    it('applies functions right to left', () => {
      const fn = compose(
        (x: number) => x * 2,
        (x: number) => x + 1,
      );
      expect(fn(2)).toBe(6);
    });
  });

  describe('identity', () => {
    it('returns the same value', () => {
      expect(identity(42)).toBe(42);
      const obj = { a: 1 };
      expect(identity(obj)).toBe(obj);
    });
  });

  describe('constant', () => {
    it('returns a function that always returns the value', () => {
      const always42 = constant(42);
      expect(always42()).toBe(42);
      expect(always42()).toBe(42);
    });
  });

  describe('memoize', () => {
    it('caches function results', () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoize(fn);

      expect(memoized(2)).toBe(4);
      expect(memoized(2)).toBe(4);
      expect(fn).toHaveBeenCalledTimes(1);

      expect(memoized(3)).toBe(6);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('memoizeWithTTL', () => {
    it('caches with expiration', async () => {
      const fn = vi.fn((x: number) => x * 2);
      const memoized = memoizeWithTTL(fn, 50);

      expect(memoized(2)).toBe(4);
      expect(memoized(2)).toBe(4);
      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((r) => setTimeout(r, 60));

      expect(memoized(2)).toBe(4);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('debounce', () => {
    it('delays execution', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 50);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      await new Promise((r) => setTimeout(r, 60));

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('can be cancelled', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 50);

      debounced();
      debounced.cancel();

      await new Promise((r) => setTimeout(r, 60));

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    it('limits execution rate', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 50);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((r) => setTimeout(r, 60));

      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('groupBy', () => {
    it('groups by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, (item) => item.type);
      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });
  });

  describe('keyBy', () => {
    it('creates object keyed by function', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ];
      const result = keyBy(items, (item) => item.id);
      expect(result).toEqual({
        1: { id: 1, name: 'a' },
        2: { id: 2, name: 'b' },
      });
    });
  });

  describe('partition', () => {
    it('splits by predicate', () => {
      const [evens, odds] = partition([1, 2, 3, 4, 5], (x) => x % 2 === 0);
      expect(evens).toEqual([2, 4]);
      expect(odds).toEqual([1, 3, 5]);
    });
  });

  describe('chunk', () => {
    it('splits into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('throws on invalid size', () => {
      expect(() => chunk([1, 2, 3], 0)).toThrow();
    });
  });

  describe('uniqBy', () => {
    it('removes duplicates by key', () => {
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ];
      const result = uniqBy(items, (item) => item.id);
      expect(result).toEqual([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ]);
    });
  });
});
