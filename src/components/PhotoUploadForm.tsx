"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { compressImage } from "@/lib/compressImage";
import { MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/schema";
import { trackingParamsFromSearchParams } from "@/lib/trackingParams";
import "./photo-upload.css";

type Status = "idle" | "compressing" | "submitting" | "success" | "error";

type ImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

export default function PhotoUploadForm() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") ?? "";
  const email = searchParams.get("email") ?? "";
  const tracking = trackingParamsFromSearchParams(searchParams);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
    setErrorMessage("");
    setStatus("submitting");

    const data = new FormData();
    if (name) data.set("name", name);
    if (email) data.set("email", email);
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

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="upload-widget-font rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Thank you!</h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">Your photo has been uploaded successfully.</p>
      </div>
    );
  }

  const isBusy = status === "submitting" || status === "compressing";

  return (
    <div className="upload-widget-font space-y-5">
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
