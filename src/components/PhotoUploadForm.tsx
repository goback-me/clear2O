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
const PHONE_CHAR_RE = /[^0-9+()\-.\s]/g;
const AGE_CHAR_RE = /[^0-9]/g;

function validateContactField(key: "name" | "email" | "phone", value: string): string | undefined {
  if (key === "name") return value.trim().length < 2 ? "Please enter your full name" : undefined;
  if (key === "email") return !EMAIL_RE.test(value.trim()) ? "Please enter a valid email address" : undefined;
  if (key === "phone") return !PHONE_RE.test(value.trim()) ? "Please enter a valid phone number" : undefined;
}

function validateAgeLocationField(key: "age" | "location", value: string): string | undefined {
  if (key === "age") {
    const age = Number(value.trim());
    if (!value.trim() || !Number.isInteger(age) || age < 1 || age > 120) return "Please enter a valid age";
    return undefined;
  }
  return value.trim().length < 2 ? "Please enter your location" : undefined;
}

export default function PhotoUploadForm() {
  const searchParams = useSearchParams();
  const paramName = searchParams.get("name") ?? "";
  const paramEmail = searchParams.get("email") ?? "";
  const paramPhone = searchParams.get("phone") ?? "";
  const hasLeadParams = Boolean(paramName && paramEmail && paramPhone);
  const tracking = trackingParamsFromSearchParams(searchParams);

  const totalSteps = hasLeadParams ? 3 : 4;

  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [meterImages, setMeterImages] = useState<ImageItem[]>([]);
  const [frontageImages, setFrontageImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [ageLocation, setAgeLocation] = useState({ age: "", location: "" });
  const [ageLocationErrors, setAgeLocationErrors] = useState<Record<string, string | undefined>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [contactErrors, setContactErrors] = useState<Record<string, string | undefined>>({});

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  async function handleFiles(
    fileList: FileList | File[] | undefined,
    images: ImageItem[],
    setImages: (update: (prev: ImageItem[]) => ImageItem[]) => void
  ) {
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

  function removeImage(id: string, setImages: (update: (prev: ImageItem[]) => ImageItem[]) => void) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  function goNext() {
    setErrorMessage("");

    if (step === 1) {
      if (meterImages.length === 0) {
        setErrorMessage("Please attach a photo of your water meter and surroundings.");
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (frontageImages.length === 0) {
        setErrorMessage("Please attach a photo of the full frontage of your property.");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      const errors: Record<string, string> = {};
      const age = validateAgeLocationField("age", ageLocation.age);
      const location = validateAgeLocationField("location", ageLocation.location);
      if (age) errors.age = age;
      if (location) errors.location = location;
      setAgeLocationErrors(errors);
      if (Object.keys(errors).length > 0) return;

      if (hasLeadParams) {
        onSubmit();
      } else {
        setStep(4);
      }
    }
  }

  function goBack() {
    setErrorMessage("");
    setStep((s) => Math.max(1, s - 1));
  }

  async function onSubmit() {
    let name = paramName;
    let email = paramEmail;
    let phone = paramPhone;

    if (!hasLeadParams) {
      const errors: Record<string, string> = {};
      const name_ = validateContactField("name", contact.name);
      const email_ = validateContactField("email", contact.email);
      const phone_ = validateContactField("phone", contact.phone);
      if (name_) errors.name = name_;
      if (email_) errors.email = email_;
      if (phone_) errors.phone = phone_;
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
    data.set("age", ageLocation.age.trim());
    data.set("location", ageLocation.location.trim());
    Object.entries(tracking).forEach(([key, value]) => data.set(key, value));
    meterImages.forEach((img) => data.append("meterImage", img.file));
    frontageImages.forEach((img) => data.append("frontageImage", img.file));

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
  const isLastStep = step === 3 && hasLeadParams;
  const nextLabel =
    status === "compressing" ? "Processing…" : status === "submitting" ? "Uploading…" : isLastStep ? "Upload & Continue" : "Next";

  return (
    <div className="upload-widget-font space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">
        Step {step} of {totalSteps}
      </p>

      {step === 1 && (
        <PhotoStep
          title="Photo of your water meter and surroundings"
          images={meterImages}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          inputRef={inputRef}
          onFiles={(files) => handleFiles(files, meterImages, setMeterImages)}
          onRemove={(id) => removeImage(id, setMeterImages)}
        />
      )}

      {step === 2 && (
        <PhotoStep
          title="Full frontage photo of your property"
          images={frontageImages}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          inputRef={inputRef}
          onFiles={(files) => handleFiles(files, frontageImages, setFrontageImages)}
          onRemove={(id) => removeImage(id, setFrontageImages)}
        />
      )}

      {step === 3 && (
        <div className="space-y-3">
          <ContactField
            label="Age"
            value={ageLocation.age}
            error={ageLocationErrors.age}
            onChange={(v) => {
              const cleaned = v.replace(AGE_CHAR_RE, "");
              setAgeLocation((p) => ({ ...p, age: cleaned }));
              setAgeLocationErrors((prev) =>
                prev.age ? { ...prev, age: validateAgeLocationField("age", cleaned) } : prev
              );
            }}
            onBlur={() =>
              setAgeLocationErrors((prev) => ({ ...prev, age: validateAgeLocationField("age", ageLocation.age) }))
            }
            placeholder="35"
            type="number"
          />
          <ContactField
            label="Location"
            value={ageLocation.location}
            error={ageLocationErrors.location}
            onChange={(v) => {
              setAgeLocation((p) => ({ ...p, location: v }));
              setAgeLocationErrors((prev) =>
                prev.location ? { ...prev, location: validateAgeLocationField("location", v) } : prev
              );
            }}
            onBlur={() =>
              setAgeLocationErrors((prev) => ({
                ...prev,
                location: validateAgeLocationField("location", ageLocation.location),
              }))
            }
            placeholder="Suburb or postcode"
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <ContactField
            label="Full name"
            value={contact.name}
            error={contactErrors.name}
            onChange={(v) => {
              setContact((p) => ({ ...p, name: v }));
              setContactErrors((prev) => (prev.name ? { ...prev, name: validateContactField("name", v) } : prev));
            }}
            onBlur={() => setContactErrors((prev) => ({ ...prev, name: validateContactField("name", contact.name) }))}
            placeholder="Jane Smith"
            autoComplete="name"
          />
          <ContactField
            label="Email"
            value={contact.email}
            error={contactErrors.email}
            onChange={(v) => {
              setContact((p) => ({ ...p, email: v }));
              setContactErrors((prev) => (prev.email ? { ...prev, email: validateContactField("email", v) } : prev));
            }}
            onBlur={() =>
              setContactErrors((prev) => ({ ...prev, email: validateContactField("email", contact.email) }))
            }
            placeholder="jane@example.com"
            type="email"
            autoComplete="email"
          />
          <ContactField
            label="Phone number"
            value={contact.phone}
            error={contactErrors.phone}
            onChange={(v) => {
              const cleaned = v.replace(PHONE_CHAR_RE, "");
              setContact((p) => ({ ...p, phone: cleaned }));
              setContactErrors((prev) =>
                prev.phone ? { ...prev, phone: validateContactField("phone", cleaned) } : prev
              );
            }}
            onBlur={() =>
              setContactErrors((prev) => ({ ...prev, phone: validateContactField("phone", contact.phone) }))
            }
            placeholder="+61 400 000 000"
            type="tel"
            autoComplete="tel"
          />
        </div>
      )}

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <div className="flex gap-3">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            disabled={isBusy}
            className="mt-5 w-1/3 rounded-lg border border-[#cfd6e0] bg-white p-3.5 text-sm font-extrabold tracking-[0.3px] text-[#1E1E1E] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={step === 4 ? onSubmit : goNext}
          disabled={isBusy}
          className="mt-5 w-full rounded-lg border-none bg-[#297EFF] p-3.5 text-sm font-extrabold tracking-[0.3px] text-white transition-colors hover:bg-[#1a6ae8] disabled:cursor-not-allowed disabled:bg-[#c9d3e0]"
        >
          {step === 4
            ? status === "submitting"
              ? "Uploading…"
              : "Upload & Continue"
            : nextLabel}
        </button>
      </div>
    </div>
  );
}

function PhotoStep({
  title,
  images,
  isDragging,
  setIsDragging,
  inputRef,
  onFiles,
  onRemove,
}: {
  title: string;
  images: ImageItem[];
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | File[] | undefined) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          onFiles(e.dataTransfer.files);
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
        <div className="text-base font-bold text-[#1E1E1E]">{title}</div>
        <p className="mt-1 text-xs text-[#6B6B6B]">JPG or PNG, up to {MAX_IMAGE_MB}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files ?? undefined);
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
                  onRemove(img.id);
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
    </div>
  );
}

function ContactField({
  label,
  value,
  error,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-[#1E1E1E] outline-none transition-colors placeholder:text-[#9CA3AF] ${
          error ? "border-red-300 focus:border-red-500" : "border-[#cfd6e0] focus:border-[#297EFF]"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
