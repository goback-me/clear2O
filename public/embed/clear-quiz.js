/*
 * Clear2O quiz — embeddable widget.
 * Usage: <div id="clear2o-quiz"></div><script src=".../embed/clear-quiz.js"></script>
 * Override the target with a data attribute: <script src="..." data-target="my-div-id">
 */
(function () {
  var thisScript = document.currentScript;
  var apiBase = new URL(thisScript.src, window.location.href).origin;
  var targetId = thisScript.getAttribute("data-target") || "clear2o-quiz";
  var root = document.getElementById(targetId);
  if (!root) {
    console.error('[clear2o-quiz] No element with id "' + targetId + '" found on the page.');
    return;
  }

  var TRACKING_PARAM_KEYS = [
    "lead_source", "campaign", "adset", "ad_name",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_adset", "utm_ad",
  ];
  function getTrackingParams() {
    var params = new URLSearchParams(window.location.search);
    var out = {};
    TRACKING_PARAM_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value && value.trim()) out[key] = value.trim().slice(0, 200);
    });
    return out;
  }

  if (!document.getElementById("c2o-quiz-style")) {
    var style = document.createElement("style");
    style.id = "c2o-quiz-style";
    style.textContent =
      '@import url("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700,800&display=swap");' +
      "#" + targetId + ", #" + targetId + " *{box-sizing:border-box;}" +
      "#" + targetId + "{font-family:'General Sans',sans-serif;}" +
      "#" + targetId + " .c2o-bg{position:relative;display:flex;align-items:center;justify-content:center;padding:48px 20px;background:#f6f7fb;border-radius:28px;}" +
      "#" + targetId + " .c2o-card{position:relative;z-index:2;width:100%;max-width:480px;background:#fff;border:1px solid rgba(15,23,42,.09);border-radius:28px;padding:40px;box-shadow:0 8px 24px rgba(0,0,0,.12);color:#0e1116;}" +
      "@media(max-width:600px){#" + targetId + " .c2o-card{padding:30px 22px}}" +
      "#" + targetId + " .c2o-progress{display:flex;gap:8px;margin-bottom:34px;}" +
      "#" + targetId + " .c2o-progress .dot{height:5px;flex:1;border-radius:100px;background:rgba(15,23,42,.08);overflow:hidden;}" +
      "#" + targetId + " .c2o-progress .dot .fill{height:100%;background:linear-gradient(90deg,#4d6dff,#7d9bff);transition:width .4s ease;width:0;}" +
      "#" + targetId + " .qtag{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#3b62ff;font-weight:700;margin-bottom:10px;}" +
      "#" + targetId + " h3{font-size:1.5rem;font-weight:700;margin-bottom:8px;line-height:1.1;}" +
      "#" + targetId + " .qsub{color:rgba(14,17,22,.64);font-size:.92rem;margin-bottom:28px;}" +
      "#" + targetId + " .c2o-opt-grid{display:flex;flex-direction:column;gap:14px;margin-bottom:10px;}" +
      "#" + targetId + " .c2o-opt{border:1.5px solid rgba(15,23,42,.09);background:#f2f4f9;border-radius:18px;padding:18px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;transition:all .2s ease;}" +
      "#" + targetId + " .c2o-opt:hover{border-color:rgba(125,155,255,.5);}" +
      "#" + targetId + " .c2o-opt.selected{border-color:#3b62ff;background:rgba(59,98,255,.14);box-shadow:0 0 0 1px #3b62ff inset;}" +
      "#" + targetId + " .oc-icon{width:44px;height:44px;border-radius:13px;background:rgba(59,98,255,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;}" +
      "#" + targetId + " .oc-icon svg{width:21px;height:21px;color:#3b62ff;}" +
      "#" + targetId + " .c2o-opt.selected .oc-icon{background:#3b62ff;}" +
      "#" + targetId + " .c2o-opt.selected .oc-icon svg{color:#fff;}" +
      "#" + targetId + " .oc-text h5{font-size:.98rem;font-weight:700;margin-bottom:3px;}" +
      "#" + targetId + " .oc-text p{font-size:.82rem;color:rgba(14,17,22,.64);font-weight:500;margin:0;}" +
      "#" + targetId + " .c2o-secure{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;padding-top:18px;border-top:1px solid rgba(15,23,42,.09);font-size:.78rem;color:rgba(14,17,22,.44);}" +
      "#" + targetId + " .c2o-secure svg{width:14px;height:14px;flex-shrink:0;}" +
      "#" + targetId + " .c2o-field{margin-bottom:16px;}" +
      "#" + targetId + " .c2o-field label{display:block;font-size:.82rem;font-weight:700;color:rgba(14,17,22,.64);margin-bottom:8px;}" +
      "#" + targetId + " .c2o-field input{width:100%;background:#f2f4f9;border:1.5px solid rgba(15,23,42,.09);border-radius:13px;padding:15px 16px;color:#0e1116;font-size:.95rem;font-family:inherit;}" +
      "#" + targetId + " .c2o-field input:focus{outline:none;border-color:#3b62ff;}" +
      "#" + targetId + " .c2o-nav{display:flex;align-items:center;justify-content:space-between;margin-top:30px;gap:14px;}" +
      "#" + targetId + " .c2o-back{font-weight:700;font-size:.9rem;color:rgba(14,17,22,.64);cursor:pointer;background:none;border:none;padding:0;font-family:inherit;}" +
      "#" + targetId + " .c2o-back:hover{color:#0e1116;}" +
      "#" + targetId + " .c2o-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:17px 30px;border-radius:100px;font-weight:700;font-size:.95rem;cursor:pointer;border:none;transition:transform .25s ease,box-shadow .25s ease,background .25s ease;font-family:inherit;}" +
      "#" + targetId + " .c2o-btn-primary{background:linear-gradient(135deg,#4d6dff,#2a45e0);color:#fff;box-shadow:0 14px 34px -10px rgba(59,98,255,.22);}" +
      "#" + targetId + " .c2o-btn-primary:hover:not(:disabled){transform:translateY(-2px);}" +
      "#" + targetId + " .c2o-btn-ghost{background:transparent;color:#0e1116;border:1.5px solid rgba(15,23,42,.18);}" +
      "#" + targetId + " .c2o-btn-block{width:100%;}" +
      "#" + targetId + " .c2o-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}" +
      "#" + targetId + " .c2o-confirm{text-align:center;padding:10px 0 0;}" +
      "#" + targetId + " .tick-circle{width:74px;height:74px;border-radius:50%;background:rgba(40,196,138,.15);border:1.5px solid rgba(40,196,138,.4);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;}" +
      "#" + targetId + " .tick-circle svg{width:34px;height:34px;color:#1fae7a;}" +
      "#" + targetId + " .c2o-summary{text-align:left;background:#f2f4f9;border:1px solid rgba(15,23,42,.09);border-radius:16px;padding:20px 22px;margin-bottom:26px;font-size:.88rem;}" +
      "#" + targetId + " .c2o-summary div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(15,23,42,.09);}" +
      "#" + targetId + " .c2o-summary div:last-child{border-bottom:none;}" +
      "#" + targetId + " .c2o-summary span:first-child{color:rgba(14,17,22,.44);font-weight:600;}" +
      "#" + targetId + " .c2o-summary span:last-child{font-weight:700;text-align:right;}" +
      "#" + targetId + " .c2o-err{color:#e5484d;font-size:.85rem;margin-bottom:12px;}";
    document.head.appendChild(style);
  }

  var ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    rent: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    cash: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    na: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    shield: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
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
    } else if (step === 7) {
      body =
        '<div class="c2o-confirm"><div class="tick-circle">' +
        svg(ICONS.check, 2.5) +
        "</div><h3>You're reserved, " +
        escapeHtml(state.name.split(" ")[0] || "there") +
        ' 🎉</h3><p>A Clear2O specialist will call within 1 business day to confirm your free installation and lock in your fixed price.</p>' +
        '<div class="c2o-summary"><div><span>Owns home</span><span>' +
        escapeHtml(state.ownsHome || "-") +
        "</span></div><div><span>Financing</span><span>" +
        escapeHtml(state.financing || "-") +
        "</span></div><div><span>Contact</span><span>" +
        escapeHtml(state.phone || "-") +
        " · " +
        escapeHtml(state.email || "-") +
        "</span></div><div><span>Suburb</span><span>" +
        escapeHtml(state.suburb || "-") +
        '</span></div></div>' +
        '<a href="tel:0448162427" class="c2o-btn c2o-btn-ghost c2o-btn-block">Or call us now on 0448 162 427</a></div>';
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
    var tracking = getTrackingParams();
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
        submitting = false;
        goToStep(7);
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
})();
