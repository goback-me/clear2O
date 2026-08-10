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

  const meterImages = form.getAll("meterImage").filter((v): v is File => v instanceof File && v.size > 0);
  const frontageImages = form.getAll("frontageImage").filter((v): v is File => v instanceof File && v.size > 0);
  const images = [...meterImages, ...frontageImages];

  if (meterImages.length === 0 || frontageImages.length === 0) {
    return withCors(
      NextResponse.json({ error: "Please attach both the water meter and frontage photos." }, { status: 400 })
    );
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

  // Either passed through as a redirect param from an earlier lead-capture
  // form, or collected directly on this page when those params are absent.
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const age = String(form.get("age") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();

  async function sniff(file: File) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = await fileTypeFromBuffer(buffer);
    if (!sniffed || !ACCEPTED_IMAGE_TYPES.includes(sniffed.mime as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      throw new Error(`"${file.name}" isn't a supported image type. Only JPEG, PNG, or WEBP are allowed.`);
    }
    return { file, buffer, mime: sniffed.mime, ext: sniffed.ext };
  }

  let sniffedMeterImages, sniffedFrontageImages;
  try {
    sniffedMeterImages = await Promise.all(meterImages.map(sniff));
    sniffedFrontageImages = await Promise.all(frontageImages.map(sniff));
  } catch (err) {
    return withCors(NextResponse.json({ error: (err as Error).message }, { status: 400 }));
  }

  async function uploadTypedImages(
    sniffed: { file: File; buffer: Buffer; mime: string; ext: string }[],
    parentFolderId: string
  ) {
    return Promise.all(
      sniffed.map(async ({ file, buffer, mime, ext }, index) => {
        const uploaded = await uploadFileToDrive({
          buffer,
          filename: `photo-${Date.now()}-${index + 1}.${ext}`,
          mimeType: mime,
          parentFolderId,
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
  }

  try {
    const submittedAt = new Date().toISOString();
    const folderName = name && email ? `${name} - ${email}` : `Clear2O - Unidentified upload - ${submittedAt}`;
    const clientFolder = await createClientFolder({ folderName });

    const [meterFolder, frontageFolder] = await Promise.all([
      createClientFolder({ folderName: "Water meter and surroundings", parentId: clientFolder.id }),
      createClientFolder({ folderName: "Full frontage of property", parentId: clientFolder.id }),
    ]);

    const [uploadedMeterImages, uploadedFrontageImages] = await Promise.all([
      uploadTypedImages(sniffedMeterImages, meterFolder.id),
      uploadTypedImages(sniffedFrontageImages, frontageFolder.id),
    ]);

    await sendToWebhook({
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      age: age || undefined,
      location: location || undefined,
      mainFolderLink: driveFolderLink(rootFolderId),
      clientFolderLink: clientFolder.viewLink,
      meterFolderLink: meterFolder.viewLink,
      frontageFolderLink: frontageFolder.viewLink,
      meterImages: uploadedMeterImages,
      frontageImages: uploadedFrontageImages,
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
