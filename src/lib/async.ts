/**
 * Generic async utilities.
 */

/**
 * Map items to promises with a concurrency cap. Preserves input order.
 * Used where upstream services rate-limit parallel requests (e.g. the AnyModel
 * gateway, which returns 429/502 when too many requests fire at once).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}
