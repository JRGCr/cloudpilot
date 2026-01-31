/**
 * Functional programming utilities
 */

// Composition

type AnyFunction = (...args: unknown[]) => unknown;

export function pipe<A>(initial: A): A;
export function pipe<A, B>(initial: A, fn1: (a: A) => B): B;
export function pipe<A, B, C>(initial: A, fn1: (a: A) => B, fn2: (b: B) => C): C;
export function pipe<A, B, C, D>(
  initial: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  initial: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  initial: A,
  fn1: (a: A) => B,
  fn2: (b: B) => C,
  fn3: (c: C) => D,
  fn4: (d: D) => E,
  fn5: (e: E) => F,
): F;
export function pipe(initial: unknown, ...fns: AnyFunction[]): unknown {
  return fns.reduce((acc, fn) => fn(acc), initial);
}

export async function pipeAsync<A>(initial: A): Promise<A>;
export async function pipeAsync<A, B>(initial: A, fn1: (a: A) => B | Promise<B>): Promise<B>;
export async function pipeAsync<A, B, C>(
  initial: A,
  fn1: (a: A) => B | Promise<B>,
  fn2: (b: B) => C | Promise<C>,
): Promise<C>;
export async function pipeAsync<A, B, C, D>(
  initial: A,
  fn1: (a: A) => B | Promise<B>,
  fn2: (b: B) => C | Promise<C>,
  fn3: (c: C) => D | Promise<D>,
): Promise<D>;
export async function pipeAsync<A, B, C, D, E>(
  initial: A,
  fn1: (a: A) => B | Promise<B>,
  fn2: (b: B) => C | Promise<C>,
  fn3: (c: C) => D | Promise<D>,
  fn4: (d: D) => E | Promise<E>,
): Promise<E>;
export async function pipeAsync(initial: unknown, ...fns: AnyFunction[]): Promise<unknown> {
  let result = initial;
  for (const fn of fns) {
    result = await fn(result);
  }
  return result;
}

export function compose<A, B>(fn1: (a: A) => B): (a: A) => B;
export function compose<A, B, C>(fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => C;
export function compose<A, B, C, D>(
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => D;
export function compose<A, B, C, D, E>(
  fn4: (d: D) => E,
  fn3: (c: C) => D,
  fn2: (b: B) => C,
  fn1: (a: A) => B,
): (a: A) => E;
export function compose(...fns: AnyFunction[]): AnyFunction {
  return (initial: unknown) => fns.reduceRight((acc, fn) => fn(acc), initial);
}

// Identity

export function identity<T>(value: T): T {
  return value;
}

export function constant<T>(value: T): () => T {
  return () => value;
}

// Caching

export function memoize<T extends (...args: Parameters<T>) => ReturnType<T>>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

export function memoizeWithTTL<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ttlMs: number,
): T {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, timestamp: now });
    return result;
  }) as T;
}

// Rate Limiting

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, ms);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

export function throttle<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let lastCall = 0;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

// Collection Utilities

export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

export function keyBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      acc[key] = item;
      return acc;
    },
    {} as Record<K, T>,
  );
}

export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];

  for (const item of array) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }

  return [truthy, falsy];
}

export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be positive');
  }

  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function uniqBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];

  for (const item of array) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}
