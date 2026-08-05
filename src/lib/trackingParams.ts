import { TRACKING_PARAM_KEYS } from "@/lib/schema";

const MAX_LEN = 200;

export function trackingParamsFromSearchParams(
  searchParams: { get(key: string): string | null }
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TRACKING_PARAM_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) out[key] = value.slice(0, MAX_LEN);
  }
  return out;
}

export function trackingParamsFromFormData(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TRACKING_PARAM_KEYS) {
    const value = String(formData.get(key) ?? "").trim();
    if (value) out[key] = value.slice(0, MAX_LEN);
  }
  return out;
}

export function trackingParamsFromObject(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body || typeof body !== "object") return out;
  const record = body as Record<string, unknown>;
  for (const key of TRACKING_PARAM_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, MAX_LEN);
  }
  return out;
}
