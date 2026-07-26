export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  retryDelayMs = 2000,
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500 && i < retries) {
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      return res;
    } catch (err) {
      if (i >= retries) throw err;
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }
  throw new Error("fetchWithRetry exhausted");
}
