import { NextRequest, NextResponse } from "next/server";
import { quizFieldsSchema } from "@/lib/schema";
import { sendToWebhook } from "@/lib/webhook";
import { isRateLimited } from "@/lib/rateLimit";
import { withCors, corsPreflight } from "@/lib/cors";
import { trackingParamsFromObject } from "@/lib/trackingParams";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return withCors(
      NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = quizFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return withCors(
      NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid submission." },
        { status: 400 }
      )
    );
  }

  try {
    await sendToWebhook({
      ...parsed.data,
      ...trackingParamsFromObject(body),
      submittedAt: new Date().toISOString(),
    });
    return withCors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Quiz submission failed:", err);
    return withCors(
      NextResponse.json(
        { error: "Something went wrong while submitting. Please try again shortly." },
        { status: 502 }
      )
    );
  }
}
