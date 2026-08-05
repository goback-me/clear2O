import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/schema";
import { createClientFolder, uploadFileToDrive, driveFolderLink } from "@/lib/googleDrive";
import { sendToWebhook } from "@/lib/webhook";
import { isRateLimited } from "@/lib/rateLimit";
import { withCors, corsPreflight } from "@/lib/cors";
import { trackingParamsFromFormData } from "@/lib/trackingParams";

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return withCors(NextResponse.json({ error: "Invalid form submission." }, { status: 400 }));
  }

  const images = form.getAll("image").filter((v): v is File => v instanceof File && v.size > 0);

  if (images.length === 0) {
    return withCors(NextResponse.json({ error: "Please attach at least one photo." }, { status: 400 }));
  }
  if (images.length > MAX_IMAGES) {
    return withCors(
      NextResponse.json({ error: `Please attach at most ${MAX_IMAGES} images.` }, { status: 400 })
    );
  }
  const oversized = images.find((img) => img.size > MAX_IMAGE_BYTES);
  if (oversized) {
    return withCors(
      NextResponse.json(
        { error: `"${oversized.name}" is too large. Please use files under 8MB.` },
        { status: 400 }
      )
    );
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootFolderId) {
    return withCors(NextResponse.json({ error: "Server is not configured for uploads." }, { status: 500 }));
  }

  // Only known when this page was reached via a redirect from an earlier
  // lead-capture form. Without them there's no client to name a folder
  // after, so the photos go straight into the shared root folder instead.
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  const sniffedImages: { file: File; buffer: Buffer; mime: string; ext: string }[] = [];
  for (const file of images) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = await fileTypeFromBuffer(buffer);
    if (!sniffed || !ACCEPTED_IMAGE_TYPES.includes(sniffed.mime as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return withCors(
        NextResponse.json(
          { error: `"${file.name}" isn't a supported image type. Only JPEG, PNG, or WEBP are allowed.` },
          { status: 400 }
        )
      );
    }
    sniffedImages.push({ file, buffer, mime: sniffed.mime, ext: sniffed.ext });
  }

  try {
    const submittedAt = new Date().toISOString();
    const clientFolder = name && email ? await createClientFolder({ name, email }) : null;
    const uploadFolderId = clientFolder?.id ?? rootFolderId;

    const uploadedImages = await Promise.all(
      sniffedImages.map(async ({ file, buffer, mime, ext }, index) => {
        const uploaded = await uploadFileToDrive({
          buffer,
          filename: `photo-${Date.now()}-${index + 1}.${ext}`,
          mimeType: mime,
          parentFolderId: uploadFolderId,
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
      name: name || undefined,
      email: email || undefined,
      mainFolderLink: driveFolderLink(rootFolderId),
      clientFolderLink: clientFolder?.viewLink,
      images: uploadedImages,
      submittedAt,
      ...trackingParamsFromFormData(form),
    });

    return withCors(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Photo upload failed:", err);
    return withCors(
      NextResponse.json(
        { error: "Something went wrong while uploading. Please try again shortly." },
        { status: 502 }
      )
    );
  }
}
