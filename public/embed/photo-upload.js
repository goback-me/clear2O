/*
 * Clear2O photo upload — embeddable widget.
 * Usage: <div id="clear2o-upload"></div><script src=".../embed/photo-upload.js"></script>
 * Override the target with a data attribute: <script src="..." data-target="my-div-id">
 */
(function () {
  var thisScript = document.currentScript;
  var apiBase = new URL(thisScript.src, window.location.href).origin;
  var targetId = thisScript.getAttribute("data-target") || "clear2o-upload";
  var root = document.getElementById(targetId);
  if (!root) {
    console.error('[clear2o-upload] No element with id "' + targetId + '" found on the page.');
    return;
  }

  // Either passed through as a redirect param from an earlier lead-capture
  // form, or collected directly on this widget when those params are absent.
  var pageParams = new URLSearchParams(window.location.search);
  var leadName = pageParams.get("name") || "";
  var leadEmail = pageParams.get("email") || "";
  var leadPhone = pageParams.get("phone") || "";
  var hasLeadParams = Boolean(leadName && leadEmail && leadPhone);
  var EMAIL_RE = /^\S+@\S+\.\S+$/;
  var PHONE_RE = /^[0-9+()\-.\s]{7,20}$/;

  var TRACKING_PARAM_KEYS = [
    "lead_source", "campaign", "adset", "ad_name",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_adset", "utm_ad",
  ];
  var leadTracking = {};
  TRACKING_PARAM_KEYS.forEach(function (key) {
    var value = pageParams.get(key);
    if (value && value.trim()) leadTracking[key] = value.trim().slice(0, 200);
  });

  var MAX_IMAGES = 10;
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  var MAX_IMAGE_MB = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
  var CLIENT_TARGET_BYTES = 4 * 1024 * 1024;
  var MAX_DIMENSION = 2200;
  var ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
  var TOTAL_STEPS = hasLeadParams ? 3 : 4;

  if (!document.getElementById("c2o-upload-style")) {
    var style = document.createElement("style");
    style.id = "c2o-upload-style";
    style.textContent =
      '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");' +
      "#" + targetId + ", #" + targetId + " *{box-sizing:border-box;}" +
      "#" + targetId + "{font-family:'Plus Jakarta Sans',sans-serif;margin:32px 0;}" +
      "#" + targetId + " .u-step{margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#6B6B6B;}" +
      "#" + targetId + " .u-drop{cursor:pointer;border-radius:14px;border:1px dashed #cfd6e0;background:#fff;padding:36px 24px;text-align:center;transition:border-color .2s ease,background .2s ease;}" +
      "#" + targetId + " .u-drop.drag{border-color:#297EFF;background:#F3FAF9;}" +
      "#" + targetId + " .u-icon{margin:0 auto 16px;width:52px;height:52px;border-radius:50%;background:#297EFF;display:flex;align-items:center;justify-content:center;}" +
      "#" + targetId + " .u-icon svg{width:20px;height:20px;color:#fff;}" +
      "#" + targetId + " .u-title{font-size:16px;font-weight:700;color:#1E1E1E;}" +
      "#" + targetId + " .u-hint{margin-top:4px;font-size:12px;color:#6B6B6B;}" +
      "#" + targetId + " .u-previews{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}" +
      "#" + targetId + " .u-thumb{position:relative;aspect-ratio:1/1;border-radius:8px;overflow:hidden;border:1px solid #e3e8ef;}" +
      "#" + targetId + " .u-thumb img{width:100%;height:100%;object-fit:cover;display:block;}" +
      "#" + targetId + " .u-thumb button{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;font-size:13px;line-height:1;}" +
      "#" + targetId + " .u-error{margin-top:14px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:13px;padding:10px 14px;}" +
      "#" + targetId + " .u-actions{margin-top:20px;display:flex;gap:12px;}" +
      "#" + targetId + " .u-btn{width:100%;border:none;border-radius:8px;padding:14px;font-size:14px;font-weight:800;letter-spacing:.3px;color:#fff;background:#297EFF;cursor:pointer;transition:background .2s ease;}" +
      "#" + targetId + " .u-btn:disabled{background:#c9d3e0;cursor:not-allowed;}" +
      "#" + targetId + " .u-btn-back{width:33%;background:#fff;color:#1E1E1E;border:1px solid #cfd6e0;}" +
      "#" + targetId + " .u-contact{margin-bottom:0;}" +
      "#" + targetId + " .u-field{margin-bottom:12px;}" +
      "#" + targetId + " .u-field label{display:block;font-size:13px;font-weight:600;color:#1E1E1E;margin-bottom:6px;}" +
      "#" + targetId + " .u-field input{width:100%;box-sizing:border-box;border:1px solid #cfd6e0;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;color:#1E1E1E;background:#fff;}" +
      "#" + targetId + " .u-field input::placeholder{color:#9CA3AF;}" +
      "#" + targetId + " .u-field input.err{border-color:#fca5a5;}" +
      "#" + targetId + " .u-field .u-ferr{margin-top:4px;font-size:12px;color:#dc2626;}";
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
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
})();
