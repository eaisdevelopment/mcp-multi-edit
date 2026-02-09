import { DEFAULT_TIMEOUT } from '../config.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export function createCache<T>(
  ttlMs: number = DEFAULT_TIMEOUT,
): { get(key: string): T | undefined; set(key: string, value: T): void; clear(): void } {
  const store = new Map<string, CacheEntry<T>>();

  function isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() > entry.expiresAt;
  }

  function evictExpired(): void {
    for (const [key, entry] of store.entries()) {
      if (isExpired(entry)) {
        store.delete(key);
      }
    }
  }

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;

      if (isExpired(entry)) {
        store.delete(key);
        return undefined;
      }

      return entry.value;
    },

    set(key: string, value: T): void {
      if (store.size > 1000) {
        evictExpired();
      }

      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
    },

    clear(): void {
      store.clear();
    },
  };
}

export function createCacheKey(...parts: string[]): string {
  return parts.join(':');
}

export function withCache<T>(
  cache: ReturnType<typeof createCache<T>>,
  keyFn: (...args: unknown[]) => string,
  fn: (...args: unknown[]) => T,
): (...args: unknown[]) => T {
  return (...args: unknown[]): T => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
