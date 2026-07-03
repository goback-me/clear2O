import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  contactFieldsSchema,
} from "@/lib/schema";
import { uploadImageToDrive } from "@/lib/googleDrive";
import { sendToWebhook } from "@/lib/webhook";
import { isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MIN_SUBMIT_MS = 1500; // faster than this is almost certainly a bot

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const parsed = contactFieldsSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email"),
    address: form.get("address"),
    website: form.get("website") ?? "",
    renderedAt: form.get("renderedAt"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 400 }
    );
  }

  const { name, phone, email, address, website, renderedAt } = parsed.data;

  // Honeypot tripped, or the form was "filled" faster than humanly possible.
  if (website || Date.now() - renderedAt < MIN_SUBMIT_MS) {
    // Respond as if it succeeded so bots don't learn to route around the check.
    return NextResponse.json({ ok: true });
  }

  const images = form.getAll("image").filter((v): v is File => v instanceof File && v.size > 0);

  if (images.length === 0) {
    return NextResponse.json({ error: "Please attach at least one site image." }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Please attach at most ${MAX_IMAGES} images.` },
      { status: 400 }
    );
  }
  const oversized = images.find((img) => img.size > MAX_IMAGE_BYTES);
  if (oversized) {
    return NextResponse.json(
      { error: `"${oversized.name}" is too large. Please use files under 8MB.` },
      { status: 400 }
    );
  }

  const sniffedImages: { file: File; buffer: Buffer; mime: string; ext: string }[] = [];
  for (const file of images) {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Never trust the browser-supplied MIME type or file extension: sniff the
    // actual file signature so a renamed executable can't masquerade as a jpg.
    const sniffed = await fileTypeFromBuffer(buffer);
    if (!sniffed || !ACCEPTED_IMAGE_TYPES.includes(sniffed.mime as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        { error: `"${file.name}" isn't a supported image type. Only JPEG, PNG, or WEBP are allowed.` },
        { status: 400 }
      );
    }
    sniffedImages.push({ file, buffer, mime: sniffed.mime, ext: sniffed.ext });
  }

  try {
    const uploadedImages = await Promise.all(
      sniffedImages.map(async ({ file, buffer, mime, ext }, index) => {
        const uploaded = await uploadImageToDrive({
          buffer,
          filename: `${Date.now()}-${sanitizeFilename(name)}-${index + 1}.${ext}`,
          mimeType: mime,
        });
        return {
          name: file.name,
          driveFileId: uploaded.id,
          driveViewLink: uploaded.viewLink,
          mimeType: mime,
          size: file.size,
        };
      })
    );

    await sendToWebhook({
      name,
      phone,
      email,
      address,
      images: uploadedImages,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Form submission failed:", err);
    return NextResponse.json(
      { error: "Something went wrong while submitting. Please try again shortly." },
      { status: 502 }
    );
  }
}

function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "site-image";
}
