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
})();
