import "server-only";
import { google } from "googleapis";
import { Readable } from "node:stream";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    // Vercel env vars store the key with literal "\n" sequences; restore real newlines.
    key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    // Broad "drive" scope (rather than drive.file) so the service account can
    // see items shared with it after the fact rather than only files it
    // created itself — required since we're targeting a pre-existing Shared
    // Drive folder rather than a picker-based per-file grant.
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export async function uploadImageToDrive(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ id: string; viewLink: string }> {
  const drive = getDriveClient();
  const folderId = getEnv("GOOGLE_DRIVE_FOLDER_ID");

  const file = await drive.files.create({
    requestBody: {
      name: params.filename,
      parents: [folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.buffer),
    },
    fields: "id, webViewLink",
    // Required for any write against an item that lives in a Shared Drive —
    // service accounts have no storage quota of their own, so the
    // destination folder must be a Shared Drive folder, not a My Drive one.
    supportsAllDrives: true,
  });

  const fileId = file.data.id;
  if (!fileId) throw new Error("Google Drive did not return a file id");

  // Folder-level sharing (set once on the destination folder) already covers
  // access in the common case; this per-file grant guarantees the emailed
  // webhook link works even if the folder is private to the service account.
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return {
    id: fileId,
    viewLink: file.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}
