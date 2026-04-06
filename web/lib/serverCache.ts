type MemoryCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export async function getOrPopulateMemoryCache<T>(
  cache: Map<string, MemoryCacheEntry<T>>,
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = await load();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });
  return value;
}
