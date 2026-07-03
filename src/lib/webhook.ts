import "server-only";

export async function sendToWebhook(payload: {
  name: string;
  phone: string;
  email: string;
  address: string;
  images: { name: string; driveFileId: string; driveViewLink: string; mimeType: string; size: number }[];
  submittedAt: string;
}): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error("Missing required environment variable: WEBHOOK_URL");

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
