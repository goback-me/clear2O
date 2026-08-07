"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { compressImage } from "@/lib/compressImage";
import { MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/schema";
import { trackingParamsFromSearchParams } from "@/lib/trackingParams";
import "./photo-upload.css";

type Status = "idle" | "compressing" | "submitting" | "error";

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

export default function PhotoUploadForm() {
  const searchParams = useSearchParams();
  const paramName = searchParams.get("name") ?? "";
  const paramEmail = searchParams.get("email") ?? "";
  const paramPhone = searchParams.get("phone") ?? "";
  const hasLeadParams = Boolean(paramName && paramEmail && paramPhone);
  const tracking = trackingParamsFromSearchParams(searchParams);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  async function handleFiles(fileList: FileList | File[] | undefined) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setErrorMessage("");

    if (images.length + files.length > MAX_IMAGES) {
      setErrorMessage(`You can attach up to ${MAX_IMAGES} images (already have ${images.length}).`);
      return;
    }
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setErrorMessage("Please choose image files only.");
      return;
    }
    if (files.some((f) => f.size > MAX_IMAGE_BYTES)) {
      setErrorMessage(`Each image must be under ${MAX_IMAGE_MB}MB.`);
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
    setStatus("idle");
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  async function onSubmit() {
    if (images.length === 0) {
      setErrorMessage("Please attach at least one photo.");
      return;
    }

    let name = paramName;
    let email = paramEmail;
    let phone = paramPhone;

    if (!hasLeadParams) {
      const errors: Record<string, string> = {};
      if (contact.name.trim().length < 2) errors.name = "Please enter your full name";
      if (!EMAIL_RE.test(contact.email.trim())) errors.email = "Please enter a valid email address";
      if (!PHONE_RE.test(contact.phone.trim())) errors.phone = "Please enter a valid phone number";
      setContactErrors(errors);
      if (Object.keys(errors).length > 0) return;

      name = contact.name.trim();
      email = contact.email.trim();
      phone = contact.phone.trim();
    }

    setErrorMessage("");
    setStatus("submitting");

    const data = new FormData();
    data.set("name", name);
    data.set("email", email);
    data.set("phone", phone);
    Object.entries(tracking).forEach(([key, value]) => data.set(key, value));
    images.forEach((img) => data.append("image", img.file));

    try {
      const res = await fetch("/api/photo-upload", { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(body.error ?? "Something went wrong. Please try again.");
        return;
      }

      window.location.href = "https://clear20.findlocal.au/booking-page";
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  }

  const isBusy = status === "submitting" || status === "compressing";

  return (
    <div className="upload-widget-font space-y-5">
      {!hasLeadParams && (
        <div className="space-y-3">
          <ContactField
            label="Full name"
            value={contact.name}
            error={contactErrors.name}
            onChange={(v) => setContact((p) => ({ ...p, name: v }))}
            placeholder="Jane Smith"
            autoComplete="name"
          />
          <ContactField
            label="Email"
            value={contact.email}
            error={contactErrors.email}
            onChange={(v) => setContact((p) => ({ ...p, email: v }))}
            placeholder="jane@example.com"
            type="email"
            autoComplete="email"
          />
          <ContactField
            label="Phone number"
            value={contact.phone}
            error={contactErrors.phone}
            onChange={(v) => setContact((p) => ({ ...p, phone: v }))}
            placeholder="+61 400 000 000"
            type="tel"
            autoComplete="tel"
          />
        </div>
      )}

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
        className={`cursor-pointer rounded-[14px] border border-dashed bg-white px-6 py-9 text-center transition-colors ${
          isDragging ? "border-[#297EFF] bg-[#F3FAF9]" : "border-[#cfd6e0]"
        }`}
      >
        <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#297EFF]">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
          </svg>
        </div>
        <div className="text-base font-bold text-[#1E1E1E]">
          Tap to take a photo or upload from your gallery
        </div>
        <p className="mt-1 text-xs text-[#6B6B6B]">JPG or PNG, up to {MAX_IMAGE_MB}MB</p>
        <input
          ref={inputRef}
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
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isBusy || images.length === 0}
        className="mt-5 w-full rounded-lg border-none bg-[#297EFF] p-3.5 text-sm font-extrabold tracking-[0.3px] text-white transition-colors hover:bg-[#1a6ae8] disabled:cursor-not-allowed disabled:bg-[#c9d3e0]"
      >
        {status === "compressing" ? "Processing…" : status === "submitting" ? "Uploading…" : "Upload & Continue"}
      </button>
    </div>
  );
}

function ContactField({
  label,
  value,
  error,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#1E1E1E]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors ${
          error ? "border-red-300 focus:border-red-500" : "border-[#cfd6e0] focus:border-[#297EFF]"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
