import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

// In-memory per-instance limiter. Good enough to blunt casual abuse/bot
// hammering on a low-traffic form without adding infra. Because serverless
// instances are ephemeral and can scale to N copies, this is NOT a hard
// guarantee under sustained/distributed load — swap in Upstash Redis
// (see SETUP.md) if this form ever gets meaningful traffic.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return false;
}
