"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { trackingParamsFromSearchParams } from "@/lib/trackingParams";
import "/clear-quiz.css";

const TOTAL_STEPS = 6;
const AUTO_ADVANCE_MS = 350;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

type QuizState = {
  ownsHome: string;
  financing: string;
  name: string;
  phone: string;
  email: string;
  suburb: string;
};

const EMPTY_STATE: QuizState = {
  ownsHome: "",
  financing: "",
  name: "",
  phone: "",
  email: "",
  suburb: "",
};

export default function ClearQuiz() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<QuizState>(EMPTY_STATE);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function select(field: "ownsHome" | "financing", value: string, nextStep: number) {
    setState((prev) => ({ ...prev, [field]: value }));
    setTimeout(() => setStep(nextStep), AUTO_ADVANCE_MS);
  }

  async function submit() {
    if (!state.name.trim() || !state.phone.trim() || !state.email.trim()) {
      setError("Please add your name, phone number, and email so we can confirm your reservation.");
      return;
    }
    if (!EMAIL_RE.test(state.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, ...trackingParamsFromSearchParams(searchParams) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      window.location.href = "https://clear20.findlocal.au/leadgen/thankyoupage";
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="c2o c2o-bg">
      <div className="c2o-card">
        {step <= TOTAL_STEPS && (
          <div className="c2o-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div className="dot" key={i}>
                <div className="fill" style={{ width: i + 1 <= step ? "100%" : "0%" }} />
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="c2o-step">
            <div className="qtag">Step 1 of 6</div>
            <h3>Do you own your home?</h3>
            <p className="qsub">This affects whether we can proceed straight to install, or need to loop in a landlord.</p>

            <div className="c2o-opt-grid">
              <Option
                icon={<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />}
                title="Yes, I own it"
                sub="We can go ahead and confirm your install"
                selected={state.ownsHome === "Yes, I own it"}
                onClick={() => select("ownsHome", "Yes, I own it", 2)}
              />
              <Option
                icon={
                  <>
                    <rect x="3" y="7" width="18" height="14" rx="2" />
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </>
                }
                title="No, I'm renting"
                sub="We'll help you loop in your landlord"
                selected={state.ownsHome === "No, I'm renting"}
                onClick={() => select("ownsHome", "No, I'm renting", 2)}
              />
            </div>

            <SecureNote />
          </div>
        )}

        {step === 2 && (
          <div className="c2o-step">
            <div className="qtag">Step 2 of 6</div>
            <h3>Would you like to use financing?</h3>
            <p className="qsub">For your $2,599 fixed-price system.</p>

            <div className="c2o-opt-grid">
              <Option
                icon={
                  <>
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 10h20" />
                  </>
                }
                title="Yes - I'll use your financing"
                sub="Spread the $2,599 cost over time"
                selected={state.financing === "Yes - I'll use your financing"}
                onClick={() => select("financing", "Yes - I'll use your financing", 3)}
              />
              <Option
                icon={<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}
                title="No - I can pay upfront"
                sub="Pay the fixed price in full"
                selected={state.financing === "No - I can pay upfront"}
                onClick={() => select("financing", "No - I can pay upfront", 3)}
              />
              <Option
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" />
                  </>
                }
                title="I am not interested in buying"
                sub="Just checking things out for now"
                selected={state.financing === "I am not interested in buying"}
                onClick={() => select("financing", "I am not interested in buying", 3)}
              />
            </div>

            <div className="c2o-nav">
              <button type="button" className="back-link" onClick={() => setStep(1)}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <FieldStep
            tag="Step 3 of 6"
            title="What's your name?"
            sub="So we know who we're talking to when we call."
            label="Full name"
            placeholder="Jordan Smith"
            value={state.name}
            onChange={(v) => setState((p) => ({ ...p, name: v }))}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <FieldStep
            tag="Step 4 of 6"
            title="What's the best number to reach you?"
            sub="We'll call to confirm your free installation."
            label="Phone number"
            placeholder="04xx xxx xxx"
            type="tel"
            value={state.phone}
            onChange={(v) => setState((p) => ({ ...p, phone: v }))}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}

        {step === 5 && (
          <FieldStep
            tag="Step 5 of 6"
            title="What's your email address?"
            sub="We'll send your booking confirmation and install details here."
            label="Email"
            placeholder="jordan@example.com"
            type="email"
            value={state.email}
            onChange={(v) => setState((p) => ({ ...p, email: v }))}
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
            isValid={(v) => EMAIL_RE.test(v.trim())}
          />
        )}

        {step === 6 && (
          <div className="c2o-step">
            <div className="qtag">Step 6 of 6</div>
            <h3>Which suburb are you in?</h3>
            <p className="qsub">Helps us confirm we cover your area.</p>

            <div className="c2o-field">
              <label htmlFor="suburb">Suburb</label>
              <input
                id="suburb"
                type="text"
                placeholder="Joondalup"
                value={state.suburb}
                onChange={(e) => setState((p) => ({ ...p, suburb: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </div>

            {error && (
              <p style={{ color: "#e5484d", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>
            )}

            <div className="c2o-nav">
              <button type="button" className="back-link" onClick={() => setStep(5)}>
                ← Back
              </button>
              <button type="button" className="c2o-btn c2o-btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Reserve My Free Installation →"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Option({
  icon,
  title,
  sub,
  selected,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div className={`c2o-opt${selected ? " selected" : ""}`} onClick={onClick}>
      <div className="oc-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          {icon}
        </svg>
      </div>
      <div className="oc-text">
        <h5>{title}</h5>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function SecureNote() {
  return (
    <div className="c2o-secure-note">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      Your information is secure.
    </div>
  );
}

function FieldStep({
  tag,
  title,
  sub,
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  onBack,
  onNext,
  isValid = (v) => v.trim().length > 0,
}: {
  tag: string;
  title: string;
  sub: string;
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  isValid?: (value: string) => boolean;
}) {
  const valid = isValid(value);
  return (
    <div className="c2o-step">
      <div className="qtag">{tag}</div>
      <h3>{title}</h3>
      <p className="qsub">{sub}</p>

      <div className="c2o-field">
        <label>{label}</label>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) {
              e.preventDefault();
              onNext();
            }
          }}
          autoFocus
        />
        {value.trim() && !valid && (
          <p style={{ color: "#e5484d", fontSize: "0.78rem", marginTop: 8 }}>
            Please enter a valid {label.toLowerCase()}.
          </p>
        )}
      </div>

      <div className="c2o-nav">
        <button type="button" className="back-link" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="c2o-btn c2o-btn-primary" onClick={onNext} disabled={!valid}>
          Continue →
        </button>
      </div>
    </div>
  );
}
