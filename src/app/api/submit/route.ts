import { NextRequest, NextResponse } from "next/server";
import { fileTypeFromBuffer } from "file-type";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
  contactFieldsSchema,
} from "@/lib/schema";
import { createClientFolder, uploadFileToDrive } from "@/lib/googleDrive";
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
    const submittedAt = new Date().toISOString();
    const clientFolder = await createClientFolder({ name, email });

    const uploadedImages = await Promise.all(
      sniffedImages.map(async ({ file, buffer, mime, ext }, index) => {
        const uploaded = await uploadFileToDrive({
          buffer,
          filename: `image-${index + 1}.${ext}`,
          mimeType: mime,
          parentFolderId: clientFolder.id,
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

    await uploadFileToDrive({
      buffer: Buffer.from(buildLeadDetailsText({ name, phone, email, address, submittedAt, images: uploadedImages })),
      filename: "lead-details.txt",
      mimeType: "text/plain",
      parentFolderId: clientFolder.id,
    });

    await sendToWebhook({
      name,
      phone,
      email,
      address,
      clientFolderLink: clientFolder.viewLink,
      images: uploadedImages,
      submittedAt,
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

function buildLeadDetailsText(params: {
  name: string;
  phone: string;
  email: string;
  address: string;
  submittedAt: string;
  images: { name: string; driveViewLink: string }[];
}): string {
  const lines = [
    "Site Details Form Submission",
    "=============================",
    `Name:          ${params.name}`,
    `Phone:         ${params.phone}`,
    `Email:         ${params.email}`,
    `Address:       ${params.address}`,
    `Submitted at:  ${params.submittedAt}`,
    "",
    `Images (${params.images.length}):`,
    ...params.images.map((img, i) => `  ${i + 1}. ${img.name} — ${img.driveViewLink}`),
  ];
  return lines.join("\n") + "\n";
}
