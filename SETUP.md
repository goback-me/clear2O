# Site Details Form — Setup Guide

A simple, secure form (Name, Phone, Email, Address, Site Image) built with
Next.js + Tailwind v4. On submit it:

1. Uploads the image to a Google Drive folder you control.
2. Sends the form data + a link to the uploaded image to a webhook of your choice.

## 1. Google Drive setup (image storage)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or use an existing one).
2. Enable the **Google Drive API** for that project (APIs & Services → Enable APIs → search "Google Drive API").
3. Create a **Service Account**: APIs & Services → Credentials → Create Credentials → Service Account. Give it any name (e.g. `form-uploader`).
4. Open the service account → Keys → Add Key → Create new key → JSON. This downloads a `.json` file — keep it private, never commit it.
5. From that JSON file you need two values:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`
6. **The destination folder must live inside a [Shared Drive](https://support.google.com/a/users/answer/9310249)**, not a regular "My Drive" folder. Service accounts have zero personal storage quota, so uploads to a normal My Drive folder fail with `403: Service Accounts do not have storage quota` even if the folder is shared with them. Shared Drives are owned by the Drive itself, not by any one account, so this doesn't apply. (Shared Drives require Google Workspace — they aren't available on personal @gmail.com accounts.)
   - Create a Shared Drive (or use an existing one) → create/pick a folder inside it for site images.
   - Add the service account's email (the `client_email` above) as a **Content Manager** (or higher) member of the Shared Drive.
7. Copy the folder ID from its URL: `https://drive.google.com/drive/folders/<FOLDER_ID>` → `GOOGLE_DRIVE_FOLDER_ID`.

Each uploaded image is also given a public "anyone with the link can view"
permission automatically, so the link sent to your webhook always opens
without extra sharing steps.

## 2. Webhook setup

Set `WEBHOOK_URL` to any endpoint that accepts a JSON `POST`. This can be:

- A [Zapier](https://zapier.com) "Catch Hook" trigger
- A [Make](https://www.make.com) or n8n webhook node
- Your own API endpoint / CRM

The payload sent looks like:

```json
{
  "name": "Jane Smith",
  "phone": "+61 400 000 000",
  "email": "jane@example.com",
  "address": "123 Example Street, Suburb, State, Postcode",
  "images": [
    {
      "name": "photo1.jpg",
      "driveFileId": "1AbCdEf...",
      "driveViewLink": "https://drive.google.com/file/d/.../view",
      "mimeType": "image/jpeg",
      "size": 1048576
    }
  ],
  "submittedAt": "2026-07-03T04:00:00.000Z"
}
```

## 3. Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values from steps 1-2
npm run dev
```

Open http://localhost:3000 to see the form.

## 4. Deploying to Vercel

```bash
npx vercel        # first deploy, follow the prompts
```

Then add the four environment variables from `.env.example` in
**Vercel Dashboard → Project → Settings → Environment Variables**
(for `GOOGLE_PRIVATE_KEY`, paste it exactly as it appears in the JSON file,
including the `\n` sequences). Redeploy after adding them:

```bash
npx vercel --prod
```

Send the deployed URL to your client to fill in.

## Security measures already built in

- **Server-side validation** of every field (name/phone/email/address) — the
  client-side checks are only for UX, the API route re-validates everything.
- **File-signature checking**: uploaded images are verified by their actual
  binary signature (not just the filename or browser-reported MIME type), so
  a disguised non-image file is rejected even if renamed to `.jpg`.
- **Size limits**: 8MB hard cap per image (up to 10 images) enforced
  server-side; the browser also automatically downscales/recompresses large
  photos before upload.
- **Honeypot field + timing check**: a hidden field that only bots fill in,
  plus a minimum time-to-submit check, filters out most automated spam
  without needing a CAPTCHA.
- **Per-IP rate limiting** (5 submissions / 10 minutes) to blunt abuse.
- **Secrets stay server-side**: Google credentials and the webhook URL are
  only read in server code (API route), never shipped to the browser.

## Optional hardening for higher-traffic use

- Swap the in-memory rate limiter (`src/lib/rateLimit.ts`) for
  [Upstash Redis](https://upstash.com) if this form will see real traffic —
  the current limiter resets per serverless instance, so it's a soft
  deterrent, not a hard guarantee.
- Add a CAPTCHA (e.g. Cloudflare Turnstile) if spam gets past the honeypot.
