"use client";

import { useRef, useState, type FormEvent } from "react";
import { compressImage } from "@/lib/compressImage";
import { MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/schema";

type Status = "idle" | "compressing" | "submitting" | "success" | "error";

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

export default function UploadForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [renderedAt] = useState(() => Date.now());

  function validate(data: FormData): Record<string, string> {
    const errors: Record<string, string> = {};
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const address = String(data.get("address") ?? "").trim();

    if (name.length < 2) errors.name = "Please enter your full name";
    if (!/^[0-9+()\-.\s]{7,20}$/.test(phone)) errors.phone = "Please enter a valid phone number";
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Please enter a valid email address";
    if (address.length < 5) errors.address = "Please enter the site address";
    if (images.length === 0) errors.image = "Please attach at least one site image";

    return errors;
  }

  async function handleFiles(fileList: FileList | File[] | undefined) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (images.length + files.length > MAX_IMAGES) {
      setFieldErrors((prev) => ({
        ...prev,
        image: `You can attach up to ${MAX_IMAGES} images (already have ${images.length}).`,
      }));
      return;
    }

    const notImages = files.filter((f) => !f.type.startsWith("image/"));
    if (notImages.length > 0) {
      setFieldErrors((prev) => ({ ...prev, image: "Please choose image files only" }));
      return;
    }
    const tooLarge = files.filter((f) => f.size > MAX_IMAGE_BYTES);
    if (tooLarge.length > 0) {
      setFieldErrors((prev) => ({ ...prev, image: `Each image must be under ${MAX_IMAGE_MB}MB` }));
      return;
    }

    setStatus("compressing");
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setImages((prev) => [
      ...prev,
      ...compressed.map((file) => ({
        id: String(nextId.current++),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    setFieldErrors((prev) => ({ ...prev, image: "" }));
    setStatus("idle");
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");

    const data = new FormData(e.currentTarget);
    const errors = validate(data);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    data.delete("image");
    images.forEach((img) => data.append("image", img.file));
    data.set("renderedAt", String(renderedAt));

    setStatus("submitting");
    try {
      const res = await fetch("/api/submit", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Thank you!</h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Your details and images have been submitted successfully.
        </p>
      </div>
    );
  }

  const isBusy = status === "submitting" || status === "compressing";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Honeypot field — hidden from real users via CSS, bots that auto-fill every field will trip it */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Company website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          className={inputClass(!!fieldErrors.name)}
        />
      </Field>

      <Field label="Phone number" htmlFor="phone" error={fieldErrors.phone}>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+61 400 000 000"
          className={inputClass(!!fieldErrors.phone)}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={fieldErrors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="jane@example.com"
          className={inputClass(!!fieldErrors.email)}
        />
      </Field>

      <Field label="Site address" htmlFor="address" error={fieldErrors.address}>
        <textarea
          id="address"
          name="address"
          rows={3}
          placeholder="123 Example Street, Suburb, State, Postcode"
          className={inputClass(!!fieldErrors.address)}
        />
      </Field>

      <Field label="Site images" htmlFor="image" error={fieldErrors.image}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            isDragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
              : fieldErrors.image
                ? "border-red-300 dark:border-red-800"
                : "border-gray-300 hover:border-indigo-400 dark:border-gray-700 dark:hover:border-indigo-600"
          }`}
        >
          <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-gray-400">
            JPEG, PNG or WEBP, up to {MAX_IMAGE_MB}MB each — up to {MAX_IMAGES} images
          </p>
          <input
            ref={inputRef}
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files ?? undefined);
              e.target.value = "";
            }}
          />
        </div>

        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt={img.file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(img.id);
                  }}
                  aria-label={`Remove ${img.file.name}`}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </Field>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isBusy}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "compressing" ? "Processing images…" : status === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:ring-2 dark:text-gray-100 dark:bg-gray-900 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-100 dark:border-red-800"
      : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-100 dark:border-gray-700 dark:focus:ring-indigo-900/40"
  }`;
}
