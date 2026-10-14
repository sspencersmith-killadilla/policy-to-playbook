/** Shared, browser- and server-safe helpers for slide voiceovers. */
export async function narrationKey(voice: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${voice}\n${text}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Only rate limits and temporary server errors are worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/** Runs tasks with at most `limit` in flight, preserving result order. */
export async function pool<T>(count: number, limit: number, task: (i: number) => Promise<T>): Promise<T[]> {
  const out = new Array<T>(count);
  let next = 0;
  const worker = async () => {
    while (next < count) {
      const i = next++;
      out[i] = await task(i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, count) }, worker));
  return out;
}
