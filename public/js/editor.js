(function () {
  var PAGE_ICON_MAP = {
    readme: "book-open-text",
    license: "scales",
    licence: "scales",
    changelog: "clock-counter-clockwise",
    contributing: "git-pull-request",
    "code of conduct": "handshake",
    security: "shield-check",
    faq: "question",
    "getting started": "rocket-launch",
    installation: "download-simple",
    setup: "gear",
    configuration: "sliders-horizontal",
    api: "plugs-connected",
    "api reference": "plugs-connected",
    authentication: "lock-key",
    deployment: "cloud-arrow-up",
    troubleshooting: "wrench",
    architecture: "tree-structure",
    migration: "arrows-left-right",
    testing: "test-tube",
    examples: "code",
    tutorial: "graduation-cap",
    introduction: "hand-waving",
    overview: "binoculars",
    quickstart: "lightning",
    "quick start": "lightning",
    upgrade: "arrow-circle-up",
    plugins: "puzzle-piece",
    extensions: "puzzle-piece",
    glossary: "book-bookmark",
    reference: "files",
    usage: "book-open",
    guide: "compass",
    features: "star",
    "release notes": "newspaper",
    about: "info",
    support: "lifebuoy",
    contact: "envelope-simple",
    privacy: "eye-slash",
    "privacy policy": "eye-slash",
    terms: "file-text",
    "terms of service": "file-text",
  };

  var titleInput = document.querySelector("[data-page-title-input]");
  var iconInput = document.querySelector("[data-page-icon-input]");
  var autoIcon = iconInput ? !iconInput.value : false;

  if (iconInput) {
    iconInput.addEventListener("input", function () {
      autoIcon = false;
    });
  }

  if (titleInput && iconInput) {
    titleInput.addEventListener("input", function () {
      if (!autoIcon) return;
      var key = titleInput.value.trim().toLowerCase();
      iconInput.value = PAGE_ICON_MAP[key] || "";
    });
  }

  var textarea = document.getElementById("content");
  if (!textarea || typeof EasyMDE === "undefined") return;

  var form = textarea.closest("form");

  function sanitizeFileName(value) {
    return String(value || "").trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
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
    shortcuts: {
      togglePreview: null,
      toggleSideBySide: null,
    },
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
      { name: "fullscreen", action: EasyMDE.toggleFullScreen, className: "ph ph-arrows-out", title: "Fullscreen" },
      "|",
      { name: "download-markdown", action: downloadMarkdown, className: "ph ph-download-simple", title: "Download Markdown" },
      { name: "guide", action: "https://www.markdownguide.org/basic-syntax/", className: "ph ph-question", title: "Markdown Guide" },
    ],
    placeholder: "Write your documentation in Markdown...",
    renderingConfig: {
      codeSyntaxHighlighting: true,
    },
    onToggleFullScreen: function (isFullscreen) {
      document.body.classList.toggle("fullscreen", isFullscreen);
      refreshEditorLayout();
    },
    minHeight: "400px",
  });

  function refreshEditorLayout(editorInstance) {
    var targetEditor = editorInstance || editor;
    if (!targetEditor || !targetEditor.codemirror) return;

    window.requestAnimationFrame(function () {
      targetEditor.codemirror.refresh();
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

  window.addEventListener("resize", refreshEditorLayout);
  document.addEventListener("fullscreenchange", refreshEditorLayout);
})();
