(function () {
  var textarea = document.getElementById("content");
  if (!textarea || typeof EasyMDE === "undefined") return;

  var form = textarea.closest("form");
  var csrfInput = form ? form.querySelector('input[name="_csrf"]') : null;
  var previewUrl = form ? form.getAttribute("data-preview-url") : "";
  var previewRequestId = 0;
  var previewCache = new Map();

  function wrapPreviewHtml(html) {
    return '<div class="preview-shell docs-content prose">' + html + "</div>";
  }

  function fetchPreviewHtml(markdown, previewElement) {
    if (!previewUrl || !previewElement) {
      previewElement.innerHTML = wrapPreviewHtml("");
      return;
    }

    if (previewCache.has(markdown)) {
      previewElement.innerHTML = previewCache.get(markdown);
      return;
    }

    previewRequestId += 1;
    var requestId = previewRequestId;

    fetch(previewUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfInput ? csrfInput.value : "",
      },
      body: JSON.stringify({ content: markdown }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Preview request failed");
        }
        return response.json();
      })
      .then(function (payload) {
        if (requestId !== previewRequestId) {
          return;
        }
        var rendered = wrapPreviewHtml(payload && payload.html ? payload.html : "");
        previewCache.set(markdown, rendered);
        previewElement.innerHTML = rendered;
      })
      .catch(function () {
        if (requestId !== previewRequestId) {
          return;
        }
        previewElement.innerHTML = wrapPreviewHtml('<p class="preview-error">Preview unavailable.</p>');
      });
  }

  function sanitizeFileName(value) {
    return String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "");
  }

  function resolveDownloadFileName() {
    var candidates = [textarea.getAttribute("data-download-filename"), form && form.getAttribute("data-download-filename"), form && form.querySelector('input[name="slug"]') ? form.querySelector('input[name="slug"]').value : "", form && form.querySelector('input[name="title"]') ? form.querySelector('input[name="title"]').value : "", form && form.querySelector('input[name="name"]') ? form.querySelector('input[name="name"]').value : "", document.title];

    for (var i = 0; i < candidates.length; i += 1) {
      var normalized = sanitizeFileName(candidates[i]);
      if (!normalized) continue;
      if (/\.md$/i.test(normalized)) {
        return normalized;
      }
      return normalized + ".md";
    }

    return "document.md";
  }

  function downloadMarkdown(editorInstance) {
    if (!window.URL || typeof window.URL.createObjectURL !== "function") {
      return;
    }

    var markdown = editorInstance ? editorInstance.value() : "";
    var blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    var fileUrl = window.URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = fileUrl;
    link.download = resolveDownloadFileName();
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(fileUrl);
  }

  var validateUrl = form ? form.getAttribute("data-validate-url") : "";
  var pageSlug = form ? form.getAttribute("data-page-slug") : "";
  var linkCheckerPanel = document.getElementById("linkCheckerPanel");
  var linkCheckerResults = document.getElementById("linkCheckerResults");
  var linkCheckerTitle = document.getElementById("linkCheckerTitle");
  var linkCheckerClose = document.getElementById("linkCheckerClose");
  var linkCheckerLoading = false;

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function checkLinks(editorInstance) {
    if (!validateUrl || linkCheckerLoading) return;

    var markdown = editorInstance ? editorInstance.value() : "";
    if (!markdown.trim()) {
      if (linkCheckerPanel) linkCheckerPanel.style.display = "none";
      return;
    }

    linkCheckerLoading = true;
    if (linkCheckerPanel) {
      linkCheckerPanel.style.display = "";
      linkCheckerPanel.className = "link-checker-panel link-checker-loading";
    }
    if (linkCheckerTitle) linkCheckerTitle.textContent = "Checking links\u2026";
    if (linkCheckerResults) linkCheckerResults.innerHTML = "";

    fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfInput ? csrfInput.value : "",
      },
      body: JSON.stringify({ content: markdown, currentPageSlug: pageSlug }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Validation request failed");
        return response.json();
      })
      .then(function (data) {
        linkCheckerLoading = false;
        renderLinkCheckerResults(data);
      })
      .catch(function () {
        linkCheckerLoading = false;
        if (linkCheckerPanel) {
          linkCheckerPanel.className = "link-checker-panel link-checker-error";
        }
        if (linkCheckerTitle) linkCheckerTitle.textContent = "Link check failed";
        if (linkCheckerResults) linkCheckerResults.innerHTML = "";
      });
  }

  function renderLinkCheckerResults(data) {
    var broken = data.brokenLinks || [];
    var total = data.totalChecked || 0;

    if (broken.length === 0) {
      if (linkCheckerPanel) {
        linkCheckerPanel.className = "link-checker-panel link-checker-ok";
      }
      if (linkCheckerTitle) {
        linkCheckerTitle.textContent = total > 0 ? "All " + total + " link" + (total !== 1 ? "s" : "") + " valid" : "No links found";
      }
      if (linkCheckerResults) linkCheckerResults.innerHTML = "";
      return;
    }

    if (linkCheckerPanel) {
      linkCheckerPanel.className = "link-checker-panel link-checker-broken";
    }
    if (linkCheckerTitle) {
      linkCheckerTitle.textContent = broken.length + " broken link" + (broken.length !== 1 ? "s" : "") + " found";
    }

    var html = "";
    for (var i = 0; i < broken.length; i++) {
      var item = broken[i];
      var suggestionHtml = "";
      if (item.suggestedFix) {
        suggestionHtml = '<div class="link-checker-link-suggestion">' + "Suggested fix: " + '<code class="link-checker-link-href">' + escapeHtml(item.suggestedFix) + "</code> " + '<button type="button" class="link-checker-apply-btn" data-old-href="' + escapeHtml(item.href).replace(/"/g, "&quot;") + '" data-new-href="' + escapeHtml(item.suggestedFix).replace(/"/g, "&quot;") + '">Apply</button>' + "</div>";
      }
      html += '<div class="link-checker-item" data-index="' + i + '">' + '<div class="link-checker-item-details">' + '<div class="link-checker-item-link">' + '<span class="link-checker-link-text">' + escapeHtml(item.text || "untitled") + "</span>" + " \u2192 " + '<code class="link-checker-link-href">' + escapeHtml(item.href) + "</code>" + "</div>" + '<div class="link-checker-link-reason">' + escapeHtml(item.reason) + "</div>" + suggestionHtml + "</div>" + "</div>";
    }

    if (linkCheckerResults) linkCheckerResults.innerHTML = html;
  }

  function applyLinkFix(oldHref, newHref, btnElement) {
    if (!editorRef) return;
    var content = editorRef.value();
    var needle = "](" + oldHref + ")";
    var replacement = "](" + newHref + ")";
    var idx = content.indexOf(needle);
    if (idx === -1) return;
    var updated = content.substring(0, idx) + replacement + content.substring(idx + needle.length);
    editorRef.value(updated);
    var item = btnElement.closest(".link-checker-item");
    if (item) {
      item.classList.add("link-checker-item-fixed");
      item.querySelector(".link-checker-link-reason").textContent = "Fixed";
      var suggestion = item.querySelector(".link-checker-link-suggestion");
      if (suggestion) suggestion.remove();
      var hrefCode = item.querySelector(".link-checker-link-href");
      if (hrefCode) hrefCode.textContent = newHref;
    }
    var remaining = linkCheckerResults ? linkCheckerResults.querySelectorAll(".link-checker-item:not(.link-checker-item-fixed)").length : 0;
    if (remaining === 0 && linkCheckerPanel) {
      linkCheckerPanel.className = "link-checker-panel link-checker-ok";
      if (linkCheckerTitle) linkCheckerTitle.textContent = "All links fixed";
    }
  }

  if (linkCheckerResults) {
    linkCheckerResults.addEventListener("click", function (e) {
      var btn = e.target.closest(".link-checker-apply-btn");
      if (!btn) return;
      var oldHref = btn.getAttribute("data-old-href");
      var newHref = btn.getAttribute("data-new-href");
      if (oldHref && newHref) applyLinkFix(oldHref, newHref, btn);
    });
  }

  if (linkCheckerClose) {
    linkCheckerClose.addEventListener("click", function () {
      if (linkCheckerPanel) linkCheckerPanel.style.display = "none";
    });
  }

  var editorRef = null;

  var editor = new EasyMDE({
    element: textarea,
    autoDownloadFontAwesome: false,
    spellChecker: false,
    autosave: {
      enabled: true,
      uniqueId: window.location.pathname,
      delay: 5000,
    },
    status: ["autosave", "lines", "words"],
    toolbar: [
      { name: "bold", action: EasyMDE.toggleBold, className: "ph ph-text-bolder", title: "Bold" },
      { name: "italic", action: EasyMDE.toggleItalic, className: "ph ph-text-italic", title: "Italic" },
      { name: "heading", action: EasyMDE.toggleHeadingSmaller, className: "ph ph-text-h", title: "Heading" },
      "|",
      { name: "quote", action: EasyMDE.toggleBlockquote, className: "ph ph-quotes", title: "Quote" },
      { name: "unordered-list", action: EasyMDE.toggleUnorderedList, className: "ph ph-list-bullets", title: "Unordered List" },
      { name: "ordered-list", action: EasyMDE.toggleOrderedList, className: "ph ph-list-numbers", title: "Ordered List" },
      "|",
      { name: "link", action: EasyMDE.drawLink, className: "ph ph-link", title: "Link" },
      { name: "image", action: EasyMDE.drawImage, className: "ph ph-image", title: "Image" },
      { name: "table", action: EasyMDE.drawTable, className: "ph ph-table", title: "Table" },
      { name: "horizontal-rule", action: EasyMDE.drawHorizontalRule, className: "ph ph-minus", title: "Horizontal Rule" },
      "|",
      { name: "code", action: EasyMDE.toggleCodeBlock, className: "ph ph-code", title: "Code" },
      { name: "preview", action: EasyMDE.togglePreview, className: "ph ph-eye", title: "Preview" },
      { name: "side-by-side", action: EasyMDE.toggleSideBySide, className: "ph ph-columns", title: "Side by Side" },
      { name: "fullscreen", action: EasyMDE.toggleFullScreen, className: "ph ph-arrows-out", title: "Fullscreen" },
      "|",
      {
        name: "check-links",
        action: function (e) {
          checkLinks(e);
        },
        className: "ph ph-link-break",
        title: "Check Links",
      },
      { name: "download-markdown", action: downloadMarkdown, className: "ph ph-download-simple", title: "Download Markdown" },
      { name: "guide", action: "https://www.markdownguide.org/basic-syntax/", className: "ph ph-question", title: "Markdown Guide" },
    ],
    placeholder: "Write your documentation in Markdown...",
    renderingConfig: {
      codeSyntaxHighlighting: true,
    },
    minHeight: "400px",
    previewRender: function (plainText, preview) {
      if (!preview) {
        return wrapPreviewHtml("");
      }

      preview.innerHTML = wrapPreviewHtml('<p class="preview-loading">Rendering preview...</p>');
      fetchPreviewHtml(plainText, preview);
      return preview.innerHTML;
    },
  });

  editorRef = editor;

  function refreshEditorLayout() {
    window.requestAnimationFrame(function () {
      editor.codemirror.refresh();
    });
  }

  function submitEditorForm() {
    if (!form) return;
    textarea.value = editor.value();
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.submit();
  }

  if (form) {
    form.addEventListener("submit", function () {
      textarea.value = editor.value();
    });
  }

  editor.codemirror.addKeyMap({
    "Ctrl-S": function () {
      submitEditorForm();
    },
    "Cmd-S": function () {
      submitEditorForm();
    },
  });

  document.addEventListener(
    "keydown",
    function (e) {
      var isSaveCombo = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.code === "KeyS");
      if (isSaveCombo) {
        e.preventDefault();
        e.stopPropagation();
        submitEditorForm();
      }
    },
    true,
  );

  var toolbar = editor.gui && editor.gui.toolbar;
  if (toolbar) {
    toolbar.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var button = target.closest("button");
      if (!button) return;
      if (button.classList.contains("preview") || button.classList.contains("side-by-side") || button.classList.contains("fullscreen")) {
        setTimeout(refreshEditorLayout, 0);
      }
    });
  }

  window.addEventListener("resize", refreshEditorLayout);
  document.addEventListener("fullscreenchange", refreshEditorLayout);

  if (validateUrl && pageSlug && editor.value().trim()) {
    setTimeout(function () {
      checkLinks(editor);
    }, 500);
  }
})();
