import "server-only";
import { NextResponse } from "next/server";

// These endpoints are called from the embed scripts (public/embed/*.js),
// which run on whatever domain the lead-gen page is hosted on — not this
// app's own origin — so a wildcard is required, not a specific allowlist.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function withCors(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
