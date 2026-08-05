import "server-only";

export async function sendToWebhook(payload: Record<string, unknown>): Promise<void> {
  const raw = process.env.WEBHOOK_URL;
  if (!raw) throw new Error("Missing required environment variable: WEBHOOK_URL");

  const urls = raw.split(",").map((u) => u.trim()).filter(Boolean);
  const results = await Promise.allSettled(urls.map((url) => postToWebhook(url, payload)));

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const failure of failures) {
    console.error("Webhook delivery failed:", failure.reason);
  }
  if (failures.length === results.length) {
    throw new Error("All webhook deliveries failed");
  }
}

async function postToWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Webhook responded with status ${res.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
