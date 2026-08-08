/**
 * Run an async task with a hard time budget. Resolves with the task result,
 * or null if it doesn't finish within budgetMs. The task keeps running in
 * the background after timeout (its side effects are not awaited).
 */
export async function withBudget<T>(task: () => Promise<T | null>, budgetMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timerP = new Promise<T | null>((resolve) => {
    timer = setTimeout(() => resolve(null), budgetMs);
  });
  try {
    return await Promise.race([task(), timerP]);
  } finally {
    clearTimeout(timer);
  }
}
