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

  // Only present when this page was reached via a redirect from an earlier
  // lead-capture form — used server-side to file the upload under that
  // client's own Drive folder instead of the shared root folder.
  var pageParams = new URLSearchParams(window.location.search);
  var leadName = pageParams.get("name") || "";
  var leadEmail = pageParams.get("email") || "";

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

  if (!document.getElementById("c2o-upload-style")) {
    var style = document.createElement("style");
    style.id = "c2o-upload-style";
    style.textContent =
      '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");' +
      "#" + targetId + ", #" + targetId + " *{box-sizing:border-box;}" +
      "#" + targetId + "{font-family:'Plus Jakarta Sans',sans-serif;margin:32px 0;}" +
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
      "#" + targetId + " .u-btn{margin-top:20px;width:100%;border:none;border-radius:8px;padding:14px;font-size:14px;font-weight:800;letter-spacing:.3px;color:#fff;background:#297EFF;cursor:pointer;transition:background .2s ease;}" +
      "#" + targetId + " .u-btn:disabled{background:#c9d3e0;cursor:not-allowed;}";
    document.head.appendChild(style);
  }

  var images = []; // {id, file, previewUrl}
  var nextId = 0;
  var isDragging = false;
  var errorMessage = "";
  var status = "idle"; // idle | compressing | submitting | error

  function render() {
    var busy = status === "submitting" || status === "compressing";
    var btnLabel =
      status === "compressing" ? "Processing…" : status === "submitting" ? "Uploading…" : "Upload & Continue";

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

    root.innerHTML =
      '<div>' +
      '<div class="u-drop' +
      (isDragging ? " drag" : "") +
      '"><div class="u-icon">' +
      arrowIcon() +
      '</div><div class="u-title">Tap to take a photo or upload from your gallery</div>' +
      '<div class="u-hint">JPG or PNG, up to ' +
      MAX_IMAGE_MB +
      'MB</div>' +
      '<input type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none" id="c2o-file-input"></div>' +
      thumbs +
      (errorMessage ? '<div class="u-error">' + escapeHtml(errorMessage) + "</div>" : "") +
      '<button type="button" class="u-btn" id="c2o-upload-btn"' +
      (busy || images.length === 0 ? " disabled" : "") +
      ">" +
      btnLabel +
      "</button></div>";

    wireEvents();
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
    var drop = root.querySelector(".u-drop");
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

    var uploadBtn = document.getElementById("c2o-upload-btn");
    if (uploadBtn) uploadBtn.addEventListener("click", submit);
  }

  function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    var files = Array.prototype.slice.call(fileList);
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
      compressed.forEach(function (file) {
        images.push({ id: String(nextId++), file: file, previewUrl: URL.createObjectURL(file) });
      });
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
    var target = images.find(function (img) {
      return img.id === id;
    });
    if (target) URL.revokeObjectURL(target.previewUrl);
    images = images.filter(function (img) {
      return img.id !== id;
    });
    render();
  }

  function submit() {
    if (images.length === 0) {
      errorMessage = "Please attach at least one photo.";
      render();
      return;
    }
    errorMessage = "";
    status = "submitting";
    render();

    var data = new FormData();
    if (leadName) data.set("name", leadName);
    if (leadEmail) data.set("email", leadEmail);
    Object.keys(leadTracking).forEach(function (key) {
      data.set(key, leadTracking[key]);
    });
    images.forEach(function (img) {
      data.append("image", img.file);
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
