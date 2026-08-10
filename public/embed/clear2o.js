/*
 * Clear2O embeddable widgets — quiz + photo upload, one script for both.
 * Usage: <div id="clear2o-quiz"></div> and/or <div id="clear2o-upload"></div>
 *        <script src=".../embed/clear2o.js"></script>
 * Each widget only initializes if its target div is present — a page can
 * embed either one, or both. Override target ids with data attributes:
 *   <script src="..." data-quiz-target="my-quiz-div" data-upload-target="my-upload-div">
 */
(function () {
  var thisScript = document.currentScript;
  var apiBase = new URL(thisScript.src, window.location.href).origin;
  var quizTargetId = thisScript.getAttribute("data-quiz-target") || "clear2o-quiz";
  var uploadTargetId = thisScript.getAttribute("data-upload-target") || "clear2o-upload";

  var TRACKING_PARAM_KEYS = [
    "lead_source", "campaign", "adset", "ad_name",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_adset", "utm_ad",
  ];
  function getTrackingParams(params) {
    var out = {};
    TRACKING_PARAM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value && value.trim()) out[key] = value.trim().slice(0, 200);
    });
    return out;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initQuiz() {
    var root = document.getElementById(quizTargetId);
    if (!root) return;

    var tracking = getTrackingParams(new URLSearchParams(window.location.search));

    if (!document.getElementById("c2o-quiz-style")) {
      var style = document.createElement("style");
      style.id = "c2o-quiz-style";
      style.textContent =
        '@import url("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700,800&display=swap");' +
        "#" + quizTargetId + ", #" + quizTargetId + " *{box-sizing:border-box;}" +
        "#" + quizTargetId + "{font-family:'General Sans',sans-serif;}" +
        "#" + quizTargetId + " .c2o-bg{position:relative;display:flex;align-items:center;justify-content:center;background:#f6f7fb;}" +
        "#" + quizTargetId + " .c2o-card{position:relative;z-index:2;width:100%;max-width:480px;background:#fff;border:1px solid rgba(15,23,42,.09);border-radius:28px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,.12);color:#0e1116;}" +
        "@media(max-width:600px){#" + quizTargetId + " .c2o-card{padding:30px 22px}}" +
        "@media(max-width:480px){#" + quizTargetId + " .c2o-card{padding:20px 16px;border-radius:22px}}" +
        "#" + quizTargetId + " .c2o-progress{display:flex;gap:8px;margin-bottom:34px;}" +
        "#" + quizTargetId + " .c2o-progress .dot{height:5px;flex:1;border-radius:100px;background:rgba(15,23,42,.08);overflow:hidden;}" +
        "#" + quizTargetId + " .c2o-progress .dot .fill{height:100%;background:linear-gradient(90deg,#4d6dff,#7d9bff);transition:width .4s ease;width:0;}" +
        "#" + quizTargetId + " .qtag{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#3b62ff;font-weight:700;margin-bottom:10px;}" +
        "#" + quizTargetId + " h3{font-size:1.5rem;font-weight:700;margin-bottom:8px;line-height:1.1;}" +
        "#" + quizTargetId + " .qsub{color:rgba(14,17,22,.64);font-size:.92rem;margin-bottom:28px;}" +
        "#" + quizTargetId + " .c2o-opt-grid{display:flex;flex-direction:column;gap:14px;margin-bottom:10px;}" +
        "#" + quizTargetId + " .c2o-opt{border:1.5px solid rgba(15,23,42,.09);background:#f2f4f9;border-radius:18px;padding:18px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;transition:all .2s ease;}" +
        "#" + quizTargetId + " .c2o-opt:hover{border-color:rgba(125,155,255,.5);}" +
        "#" + quizTargetId + " .c2o-opt.selected{border-color:#3b62ff;background:rgba(59,98,255,.14);box-shadow:0 0 0 1px #3b62ff inset;}" +
        "#" + quizTargetId + " .oc-icon{width:44px;height:44px;border-radius:13px;background:rgba(59,98,255,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;}" +
        "#" + quizTargetId + " .oc-icon svg{width:21px;height:21px;color:#3b62ff;}" +
        "#" + quizTargetId + " .c2o-opt.selected .oc-icon{background:#3b62ff;}" +
        "#" + quizTargetId + " .c2o-opt.selected .oc-icon svg{color:#fff;}" +
        "#" + quizTargetId + " .oc-text h5{font-size:.98rem;font-weight:700;margin-bottom:3px;text-align:left;}" +
        "#" + quizTargetId + " .oc-text p{font-size:.82rem;color:rgba(14,17,22,.64);font-weight:500;margin:0;text-align:left;}" +
        "#" + quizTargetId + " .c2o-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;padding-top:18px;border-top:1px solid rgba(15,23,42,.09);font-size:.78rem;color:rgba(14,17,22,.44);}" +
        "#" + quizTargetId + " .c2o-secure svg{width:14px;height:14px;flex-shrink:0;}" +
        "#" + quizTargetId + " .c2o-field{margin-bottom:16px;}" +
        "#" + quizTargetId + " .c2o-field label{display:block;font-size:.82rem;font-weight:700;color:rgba(14,17,22,.64);margin-bottom:8px;}" +
        "#" + quizTargetId + " .c2o-field input{width:100%;background:#f2f4f9;border:1.5px solid rgba(15,23,42,.09);border-radius:13px;padding:15px 16px;color:#0e1116;font-size:.95rem;font-family:inherit;}" +
        "#" + quizTargetId + " .c2o-field input:focus{outline:none;border-color:#3b62ff;}" +
        "#" + quizTargetId + " .c2o-nav{display:flex;align-items:center;justify-content:space-between;margin-top:30px;gap:14px;}" +
        "#" + quizTargetId + " .c2o-back{font-weight:700;font-size:.9rem;color:rgba(14,17,22,.64);cursor:pointer;background:none;border:none;padding:0;font-family:inherit;}" +
        "#" + quizTargetId + " .c2o-back:hover{color:#0e1116;}" +
        "#" + quizTargetId + " .c2o-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:17px 30px;border-radius:100px;font-weight:700;font-size:.95rem;cursor:pointer;border:none;transition:transform .25s ease,box-shadow .25s ease,background .25s ease;font-family:inherit;}" +
        "#" + quizTargetId + " .c2o-btn-primary{background:linear-gradient(135deg,#4d6dff,#2a45e0);color:#fff;box-shadow:0 14px 34px -10px rgba(59,98,255,.22);}" +
        "#" + quizTargetId + " .c2o-btn-primary:hover:not(:disabled){transform:translateY(-2px);}" +
        "#" + quizTargetId + " .c2o-btn-ghost{background:transparent;color:#0e1116;border:1.5px solid rgba(15,23,42,.18);}" +
        "#" + quizTargetId + " .c2o-btn-block{width:100%;}" +
        "#" + quizTargetId + " .c2o-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}" +
        "#" + quizTargetId + " .c2o-err{color:#e5484d;font-size:.85rem;margin-bottom:12px;}";
      document.head.appendChild(style);
    }

    var ICONS = {
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      rent: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      cash: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
      na: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
      shield: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    };

    function svg(path, strokeWidth) {
      return (
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
        (strokeWidth || 1.8) +
        '">' +
        path +
        "</svg>"
      );
    }

    var TOTAL = 6;
    var state = { ownsHome: "", financing: "", name: "", phone: "", email: "", suburb: "" };
    var step = 1;
    var submitting = false;
    var errorMsg = "";
    var EMAIL_RE = /^\S+@\S+\.\S+$/;
    var FIELD_VALIDATORS = {
      email: function (v) {
        return EMAIL_RE.test(v.trim());
      },
    };
    function isFieldValid(field, value) {
      var validator = FIELD_VALIDATORS[field];
      return validator ? validator(value) : value.trim().length > 0;
    }

    function render() {
      var progress = "";
      if (step <= TOTAL) {
        progress = '<div class="c2o-progress">';
        for (var i = 1; i <= TOTAL; i++) {
          progress +=
            '<div class="dot"><div class="fill" style="width:' + (i <= step ? "100" : "0") + '%"></div></div>';
        }
        progress += "</div>";
      }

      var body = "";
      if (step === 1) {
        body =
          '<div class="qtag">Step 1 of 6</div><h3>Do you own your home?</h3>' +
          '<p class="qsub">This affects whether we can proceed straight to install, or need to loop in a landlord.</p>' +
          '<div class="c2o-opt-grid">' +
          opt("ownsHome", "Yes, I own it", "We can go ahead and confirm your install", ICONS.home, 2) +
          opt("ownsHome", "No, I'm renting", "We'll help you loop in your landlord", ICONS.rent, 2) +
          "</div>" +
          '<div class="c2o-secure">' +
          svg(ICONS.shield) +
          "Your information is secure.</div>";
      } else if (step === 2) {
        body =
          '<div class="qtag">Step 2 of 6</div><h3>Would you like to use financing?</h3>' +
          '<p class="qsub">For your $2,599 fixed-price system.</p>' +
          '<div class="c2o-opt-grid">' +
          opt("financing", "Yes - I'll use your financing", "Spread the $2,599 cost over time", ICONS.card, 3) +
          opt("financing", "No - I can pay upfront", "Pay the fixed price in full", ICONS.cash, 3) +
          opt("financing", "I am not interested in buying", "Just checking things out for now", ICONS.na, 3) +
          "</div>" +
          '<div class="c2o-nav"><button type="button" class="c2o-back" data-back="1">← Back</button></div>';
      } else if (step === 3) {
        body = fieldStep("Step 3 of 6", "What's your name?", "So we know who we're talking to when we call.", "name", "text", "Full name", "Jordan Smith", 2, 4);
      } else if (step === 4) {
        body = fieldStep("Step 4 of 6", "What's the best number to reach you?", "We'll call to confirm your free installation.", "phone", "tel", "Phone number", "04xx xxx xxx", 3, 5);
      } else if (step === 5) {
        body = fieldStep("Step 5 of 6", "What's your email address?", "We'll send your booking confirmation and install details here.", "email", "email", "Email", "jordan@example.com", 4, 6);
      } else if (step === 6) {
        body =
          '<div class="qtag">Step 6 of 6</div><h3>Which suburb are you in?</h3>' +
          '<p class="qsub">Helps us confirm we cover your area.</p>' +
          '<div class="c2o-field"><label for="c2o-suburb">Suburb</label>' +
          '<input id="c2o-suburb" type="text" placeholder="Joondalup" value="' +
          escapeHtml(state.suburb) +
          '"></div>' +
          (errorMsg ? '<p class="c2o-err">' + escapeHtml(errorMsg) + "</p>" : "") +
          '<div class="c2o-nav"><button type="button" class="c2o-back" data-back="5">← Back</button>' +
          '<button type="button" class="c2o-btn c2o-btn-primary" id="c2o-submit"' +
          (submitting ? " disabled" : "") +
          ">" +
          (submitting ? "Submitting…" : "Reserve My Free Installation →") +
          "</button></div>";
      }

      root.innerHTML = '<div class="c2o-bg"><div class="c2o-card">' + progress + body + "</div></div>";
      wireEvents();
    }

    function opt(field, value, sub, iconPath, nextStep) {
      var selected = state[field] === value;
      return (
        '<div class="c2o-opt' +
        (selected ? " selected" : "") +
        '" data-field="' +
        field +
        '" data-value="' +
        escapeHtml(value) +
        '" data-next="' +
        nextStep +
        '"><div class="oc-icon">' +
        svg(iconPath) +
        '</div><div class="oc-text"><h5>' +
        escapeHtml(value) +
        "</h5><p>" +
        escapeHtml(sub) +
        "</p></div></div>"
      );
    }

    function fieldStep(tag, title, sub, field, type, label, placeholder, backStep, nextStep) {
      var value = state[field];
      var valid = isFieldValid(field, value);
      return (
        '<div class="qtag">' +
        tag +
        "</div><h3>" +
        title +
        '</h3><p class="qsub">' +
        sub +
        '</p><div class="c2o-field"><label>' +
        label +
        '</label><input id="c2o-field-' +
        field +
        '" type="' +
        type +
        '" placeholder="' +
        placeholder +
        '" value="' +
        escapeHtml(value) +
        '">' +
        (value.trim() && !valid
          ? '<p style="color:#e5484d;font-size:.78rem;margin-top:8px;">Please enter a valid ' +
            escapeHtml(label.toLowerCase()) +
            ".</p>"
          : "") +
        "</div>" +
        '<div class="c2o-nav"><button type="button" class="c2o-back" data-back="' +
        backStep +
        '">← Back</button>' +
        '<button type="button" class="c2o-btn c2o-btn-primary" data-field-next="' +
        field +
        '" data-next="' +
        nextStep +
        '"' +
        (valid ? "" : " disabled") +
        ">Continue →</button></div>"
      );
    }

    function goToStep(n) {
      step = n;
      render();
    }

    function submitQuiz() {
      var suburbInput = document.getElementById("c2o-suburb");
      state.suburb = suburbInput ? suburbInput.value.trim() : state.suburb;

      if (!state.name.trim() || !state.phone.trim() || !state.email.trim()) {
        errorMsg = "Please add your name, phone number, and email so we can confirm your reservation.";
        render();
        return;
      }
      if (!EMAIL_RE.test(state.email.trim())) {
        errorMsg = "Please enter a valid email address.";
        render();
        return;
      }
      errorMsg = "";
      submitting = true;
      render();

      var payload = {};
      for (var key in state) payload[key] = state[key];
      for (var tkey in tracking) payload[tkey] = tracking[tkey];

      fetch(apiBase + "/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () {
            return {};
          }).then(function (body) {
            if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
          });
        })
        .then(function () {
          var thankYouUrl = new URL("https://clear20.findlocal.au/leadgen/thankyoupage");
          thankYouUrl.searchParams.set("name", state.name);
          thankYouUrl.searchParams.set("email", state.email);
          window.location.href = thankYouUrl.toString();
        })
        .catch(function (err) {
          submitting = false;
          errorMsg = err.message || "Network error. Please check your connection and try again.";
          render();
        });
    }

    function wireEvents() {
      root.querySelectorAll(".c2o-opt").forEach(function (el) {
        el.addEventListener("click", function () {
          state[el.getAttribute("data-field")] = el.getAttribute("data-value");
          var next = parseInt(el.getAttribute("data-next"), 10);
          render();
          setTimeout(function () {
            goToStep(next);
          }, 350);
        });
      });
      root.querySelectorAll(".c2o-back").forEach(function (el) {
        el.addEventListener("click", function () {
          goToStep(parseInt(el.getAttribute("data-back"), 10));
        });
      });
      root.querySelectorAll("input[id^='c2o-field-']").forEach(function (input) {
        var field = input.id.replace("c2o-field-", "");
        input.addEventListener("input", function () {
          state[field] = input.value;
          var valid = isFieldValid(field, input.value);
          var btn = root.querySelector("[data-field-next='" + field + "']");
          if (btn) btn.disabled = !valid;

          var errEl = input.parentElement.querySelector("p");
          if (input.value.trim() && !valid) {
            if (!errEl) {
              errEl = document.createElement("p");
              errEl.style.color = "#e5484d";
              errEl.style.fontSize = ".78rem";
              errEl.style.marginTop = "8px";
              input.insertAdjacentElement("afterend", errEl);
            }
            errEl.textContent = "Please enter a valid " + field + ".";
          } else if (errEl) {
            errEl.remove();
          }
        });
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && isFieldValid(field, input.value)) {
            e.preventDefault();
            var btn = root.querySelector("[data-field-next='" + field + "']");
            if (btn) goToStep(parseInt(btn.getAttribute("data-next"), 10));
          }
        });
      });
      root.querySelectorAll("[data-field-next]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          goToStep(parseInt(btn.getAttribute("data-next"), 10));
        });
      });
      var suburbInput = document.getElementById("c2o-suburb");
      if (suburbInput) {
        suburbInput.addEventListener("input", function () {
          state.suburb = suburbInput.value;
        });
        suburbInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            submitQuiz();
          }
        });
      }
      var submitBtn = document.getElementById("c2o-submit");
      if (submitBtn) submitBtn.addEventListener("click", submitQuiz);
    }

    render();
  }

  function initUpload() {
    var root = document.getElementById(uploadTargetId);
    if (!root) return;

    var pageParams = new URLSearchParams(window.location.search);
    var leadName = pageParams.get("name") || "";
    var leadEmail = pageParams.get("email") || "";
    var leadPhone = pageParams.get("phone") || "";
    var hasLeadParams = Boolean(leadName && leadEmail && leadPhone);
    var EMAIL_RE = /^\S+@\S+\.\S+$/;
    var PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;
    var leadTracking = getTrackingParams(pageParams);

    var MAX_IMAGES = 10;
    var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    var MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    var CLIENT_TARGET_BYTES = 4 * 1024 * 1024;
    var MAX_DIMENSION = 2200;
    var TOTAL_STEPS = hasLeadParams ? 3 : 4;

    if (!document.getElementById("c2o-upload-style")) {
      var style = document.createElement("style");
      style.id = "c2o-upload-style";
      style.textContent =
        '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");' +
        "#" + uploadTargetId + ", #" + uploadTargetId + " *{box-sizing:border-box;}" +
        "#" + uploadTargetId + "{font-family:'Plus Jakarta Sans',sans-serif;margin:32px 0;}" +
        "#" + uploadTargetId + " .u-step{margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6B6B6B;}" +
        "#" + uploadTargetId + " .u-drop{cursor:pointer;border-radius:14px;border:1px dashed #cfd6e0;background:#fff;padding:36px 24px;text-align:center;transition:border-color .2s ease,background .2s ease;}" +
        "#" + uploadTargetId + " .u-drop.drag{border-color:#297EFF;background:#F3FAF9;}" +
        "#" + uploadTargetId + " .u-icon{margin:0 auto 16px;width:52px;height:52px;border-radius:50%;background:#297EFF;display:flex;align-items:center;justify-content:center;}" +
        "#" + uploadTargetId + " .u-icon svg{width:20px;height:20px;color:#fff;}" +
        "#" + uploadTargetId + " .u-title{font-size:16px;font-weight:700;color:#1E1E1E;}" +
        "#" + uploadTargetId + " .u-hint{margin-top:4px;font-size:12px;color:#6B6B6B;}" +
        "#" + uploadTargetId + " .u-previews{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}" +
        "#" + uploadTargetId + " .u-thumb{position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;border:1px solid #e3e8ef;}" +
        "#" + uploadTargetId + " .u-thumb img{width:100%;height:100%;object-fit:cover;display:block;}" +
        "#" + uploadTargetId + " .u-thumb button{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;font-size:13px;line-height:1;}" +
        "#" + uploadTargetId + " .u-error{margin-top:14px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:13px;padding:10px 14px;}" +
        "#" + uploadTargetId + " .u-actions{margin-top:20px;display:flex;gap:12px;}" +
        "#" + uploadTargetId + " .u-btn{width:100%;border:none;border-radius:8px;padding:14px;font-size:14px;font-weight:800;letter-spacing:.3px;color:#fff;background:#297EFF;cursor:pointer;transition:background .2s ease;}" +
        "#" + uploadTargetId + " .u-btn:disabled{background:#c9d3e0;cursor:not-allowed;}" +
        "#" + uploadTargetId + " .u-btn-back{width:33%;background:#fff;color:#1E1E1E;border:1px solid #cfd6e0;}" +
        "#" + uploadTargetId + " .u-contact{margin-bottom:0;}" +
        "#" + uploadTargetId + " .u-field{margin-bottom:12px;}" +
        "#" + uploadTargetId + " .u-field label{display:block;font-size:13px;font-weight:600;color:#1E1E1E;margin-bottom:6px;}" +
        "#" + uploadTargetId + " .u-field input{width:100%;box-sizing:border-box;border:1px solid #cfd6e0;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;color:#1E1E1E;background:#fff;}" +
        "#" + uploadTargetId + " .u-field input::placeholder{color:#9CA3AF;}" +
        "#" + uploadTargetId + " .u-field input.err{border-color:#fca5a5;}" +
        "#" + uploadTargetId + " .u-field .u-ferr{margin-top:4px;font-size:12px;color:#dc2626;}";
      document.head.appendChild(style);
    }

    var step = 1;
    var meterImages = []; // {id, file, previewUrl}
    var frontageImages = [];
    var nextId = 0;
    var isDragging = false;
    var errorMessage = "";
    var status = "idle"; // idle | compressing | submitting | error
    var ageLocation = { age: "", location: "" };
    var ageLocationErrors = {};
    var contact = { name: "", email: "", phone: "" };
    var contactErrors = {};

    function currentImages() {
      return step === 1 ? meterImages : frontageImages;
    }
    function setCurrentImages(images) {
      if (step === 1) meterImages = images;
      else frontageImages = images;
    }
    function isLastStep() {
      return step === 3 && hasLeadParams;
    }

    function render() {
      var busy = status === "submitting" || status === "compressing";
      var nextLabel = status === "compressing" ? "Processing…" : status === "submitting" ? "Uploading…" : isLastStep() || step === 4 ? "Upload & Continue" : "Next";

      var body = "";
      if (step === 1) body = photoStepHtml("Photo of your water meter and surroundings", meterImages);
      else if (step === 2) body = photoStepHtml("Full frontage photo of your property", frontageImages);
      else if (step === 3) body = ageLocationStepHtml();
      else body = contactStepHtml();

      var actions =
        '<div class="u-actions">' +
        (step > 1 ? '<button type="button" class="u-btn u-btn-back" id="c2o-back-btn"' + (busy ? " disabled" : "") + ">Back</button>" : "") +
        '<button type="button" class="u-btn" id="c2o-next-btn"' +
        (busy ? " disabled" : "") +
        ">" +
        nextLabel +
        "</button></div>";

      root.innerHTML =
        '<div><div class="u-step">Step ' + step + " of " + TOTAL_STEPS + "</div>" +
        body +
        (errorMessage ? '<div class="u-error">' + escapeHtml(errorMessage) + "</div>" : "") +
        actions +
        "</div>";

      wireEvents();
    }

    function photoStepHtml(title, images) {
      var thumbs = "";
      if (images.length > 0) {
        thumbs = '<div class="u-previews">';
        images.forEach(function (img) {
          thumbs +=
            '<div class="u-thumb"><img src="' +
            img.previewUrl +
            '" alt=""><button type="button" data-remove="' +
            img.id +
            '">✕</button></div>';
        });
        thumbs += "</div>";
      }

      return (
        '<div class="u-drop' +
        (isDragging ? " drag" : "") +
        '"><div class="u-icon">' +
        arrowIcon() +
        '</div><div class="u-title">' +
        escapeHtml(title) +
        '</div><div class="u-hint">JPG or PNG, up to ' +
        MAX_IMAGE_MB +
        'MB</div>' +
        '<input type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none" id="c2o-file-input"></div>' +
        thumbs
      );
    }

    function ageLocationStepHtml() {
      return (
        '<div class="u-contact">' +
        textField("age", "Age", "number", "35", ageLocation, ageLocationErrors) +
        textField("location", "Location", "text", "Suburb or postcode", ageLocation, ageLocationErrors) +
        "</div>"
      );
    }

    function contactStepHtml() {
      return (
        '<div class="u-contact">' +
        textField("name", "Full name", "text", "Jane Smith", contact, contactErrors) +
        textField("email", "Email", "email", "jane@example.com", contact, contactErrors) +
        textField("phone", "Phone number", "tel", "+61 400 000 000", contact, contactErrors) +
        "</div>"
      );
    }

    function textField(key, label, type, placeholder, state, errors) {
      var err = errors[key];
      return (
        '<div class="u-field"><label>' +
        label +
        '</label><input type="' +
        type +
        '" id="c2o-field-' +
        key +
        '" value="' +
        escapeHtml(state[key]) +
        '" placeholder="' +
        placeholder +
        '" class="' +
        (err ? "err" : "") +
        '">' +
        (err ? '<div class="u-ferr">' + escapeHtml(err) + "</div>" : "") +
        "</div>"
      );
    }

    function arrowIcon() {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6"/></svg>';
    }

    function wireEvents() {
      if (step === 3) {
        ["age", "location"].forEach(function (key) {
          var el = document.getElementById("c2o-field-" + key);
          if (el) el.addEventListener("input", function () { ageLocation[key] = el.value; });
        });
      } else if (step === 4) {
        ["name", "email", "phone"].forEach(function (key) {
          var el = document.getElementById("c2o-field-" + key);
          if (el) el.addEventListener("input", function () { contact[key] = el.value; });
        });
      }

      var drop = root.querySelector(".u-drop");
      if (drop) {
        var input = document.getElementById("c2o-file-input");

        drop.addEventListener("click", function () {
          input.click();
        });
        drop.addEventListener("dragover", function (e) {
          e.preventDefault();
          isDragging = true;
          drop.classList.add("drag");
        });
        drop.addEventListener("dragleave", function () {
          isDragging = false;
          drop.classList.remove("drag");
        });
        drop.addEventListener("drop", function (e) {
          e.preventDefault();
          isDragging = false;
          handleFiles(e.dataTransfer.files);
        });
        input.addEventListener("change", function (e) {
          handleFiles(e.target.files);
          e.target.value = "";
        });

        root.querySelectorAll("[data-remove]").forEach(function (btn) {
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            removeImage(btn.getAttribute("data-remove"));
          });
        });
      }

      var backBtn = document.getElementById("c2o-back-btn");
      if (backBtn) backBtn.addEventListener("click", goBack);

      var nextBtn = document.getElementById("c2o-next-btn");
      if (nextBtn) nextBtn.addEventListener("click", step === 4 ? submit : goNext);
    }

    function handleFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      var files = Array.prototype.slice.call(fileList);
      var images = currentImages();
      errorMessage = "";

      if (images.length + files.length > MAX_IMAGES) {
        errorMessage = "You can attach up to " + MAX_IMAGES + " images (already have " + images.length + ").";
        render();
        return;
      }
      if (files.some(function (f) { return f.type.indexOf("image/") !== 0; })) {
        errorMessage = "Please choose image files only.";
        render();
        return;
      }
      if (files.some(function (f) { return f.size > MAX_IMAGE_BYTES; })) {
        errorMessage = "Each image must be under " + MAX_IMAGE_MB + "MB.";
        render();
        return;
      }

      status = "compressing";
      render();

      Promise.all(files.map(compressImage)).then(function (compressed) {
        var updated = currentImages();
        compressed.forEach(function (file) {
          updated = updated.concat([{ id: String(nextId++), file: file, previewUrl: URL.createObjectURL(file) }]);
        });
        setCurrentImages(updated);
        status = "idle";
        render();
      });
    }

    function compressImage(file) {
      if (file.type.indexOf("image/") !== 0) return Promise.resolve(file);

      return createImageBitmap(file)
        .then(function (bitmap) {
          var scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
          var width = Math.round(bitmap.width * scale);
          var height = Math.round(bitmap.height * scale);

          var canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext("2d");
          if (!ctx) return file;
          ctx.drawImage(bitmap, 0, 0, width, height);

          var quality = 0.9;
          return canvasToBlob(canvas, quality).then(function tryNext(blob) {
            if (blob && blob.size > CLIENT_TARGET_BYTES && quality > 0.4) {
              quality -= 0.15;
              return canvasToBlob(canvas, quality).then(tryNext);
            }
            if (!blob || blob.size >= file.size) return file;
            var newName = file.name.replace(/\.\w+$/, "") + ".jpg";
            return new File([blob], newName, { type: "image/jpeg" });
          });
        })
        .catch(function () {
          return file;
        });
    }

    function canvasToBlob(canvas, quality) {
      return new Promise(function (resolve) {
        canvas.toBlob(resolve, "image/jpeg", quality);
      });
    }

    function removeImage(id) {
      var images = currentImages();
      var target = images.find(function (img) {
        return img.id === id;
      });
      if (target) URL.revokeObjectURL(target.previewUrl);
      setCurrentImages(images.filter(function (img) {
        return img.id !== id;
      }));
      render();
    }

    function goBack() {
      errorMessage = "";
      step = Math.max(1, step - 1);
      render();
    }

    function goNext() {
      errorMessage = "";

      if (step === 1) {
        if (meterImages.length === 0) {
          errorMessage = "Please attach a photo of your water meter and surroundings.";
          render();
          return;
        }
        step = 2;
        render();
        return;
      }

      if (step === 2) {
        if (frontageImages.length === 0) {
          errorMessage = "Please attach a photo of the full frontage of your property.";
          render();
          return;
        }
        step = 3;
        render();
        return;
      }

      if (step === 3) {
        var errors = {};
        if (!ageLocation.age.trim()) errors.age = "Please enter your age";
        if (!ageLocation.location.trim()) errors.location = "Please enter your location";
        ageLocationErrors = errors;
        if (Object.keys(errors).length > 0) {
          render();
          return;
        }
        if (hasLeadParams) {
          submit();
        } else {
          step = 4;
          render();
        }
      }
    }

    function submit() {
      var name = leadName;
      var email = leadEmail;
      var phone = leadPhone;

      if (!hasLeadParams) {
        var errors = {};
        if (contact.name.trim().length < 2) errors.name = "Please enter your full name";
        if (!EMAIL_RE.test(contact.email.trim())) errors.email = "Please enter a valid email address";
        if (!PHONE_RE.test(contact.phone.trim())) errors.phone = "Please enter a valid phone number";
        contactErrors = errors;
        if (Object.keys(errors).length > 0) {
          render();
          return;
        }
        name = contact.name.trim();
        email = contact.email.trim();
        phone = contact.phone.trim();
      }

      errorMessage = "";
      status = "submitting";
      render();

      var data = new FormData();
      data.set("name", name);
      data.set("email", email);
      data.set("phone", phone);
      data.set("age", ageLocation.age.trim());
      data.set("location", ageLocation.location.trim());
      Object.keys(leadTracking).forEach(function (key) {
        data.set(key, leadTracking[key]);
      });
      meterImages.forEach(function (img) {
        data.append("meterImage", img.file);
      });
      frontageImages.forEach(function (img) {
        data.append("frontageImage", img.file);
      });

      fetch(apiBase + "/api/photo-upload", { method: "POST", body: data })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
            });
        })
        .then(function () {
          window.location.href = "https://clear20.findlocal.au/booking-page";
        })
        .catch(function (err) {
          status = "error";
          errorMessage = err.message || "Network error. Please check your connection and try again.";
          render();
        });
    }

    render();
  }

  initQuiz();
  initUpload();

  if (!document.getElementById(quizTargetId) && !document.getElementById(uploadTargetId)) {
    console.error(
      '[clear2o] No element with id "' + quizTargetId + '" or "' + uploadTargetId + '" found on the page.'
    );
  }
})();
