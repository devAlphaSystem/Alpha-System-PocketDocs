(function () {
  var container = document.getElementById("toastContainer");
  window.showToast = function (message, type) {
    if (!container) return;
    type = type || "info";
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML = "<span>" + escapeHtml(message) + "</span>" + '<button class="toast-close" aria-label="Close"><i class="ph ph-x"></i></button>';
    container.appendChild(toast);
    toast.querySelector(".toast-close").addEventListener("click", function () {
      toast.remove();
    });
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 5000);
  };

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  var PENDING_TOAST_KEY = "pd_pending_toast";

  function queueNextPageToast(message, type) {
    try {
      sessionStorage.setItem(
        PENDING_TOAST_KEY,
        JSON.stringify({
          message: message,
          type: type || "success",
          expiresAt: Date.now() + 15000,
        }),
      );
    } catch (_error) {}
  }

  function flushPendingToast() {
    try {
      var raw = sessionStorage.getItem(PENDING_TOAST_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_TOAST_KEY);

      var payload = JSON.parse(raw);
      if (!payload || !payload.message) return;
      if (payload.expiresAt && payload.expiresAt < Date.now()) return;

      if (typeof window.showToast === "function") {
        window.showToast(payload.message, payload.type || "success");
      }
    } catch (_error) {
      try {
        sessionStorage.removeItem(PENDING_TOAST_KEY);
      } catch (_ignored) {}
    }
  }

  flushPendingToast();

  var clickableRows = document.querySelectorAll("[data-row-link]");
  if (clickableRows.length) {
    clickableRows.forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("a, button, input, select, textarea, label, form")) return;
        var href = row.getAttribute("data-row-link");
        if (href) window.location.href = href;
      });

      row.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        var href = row.getAttribute("data-row-link");
        if (href) window.location.href = href;
      });
    });
  }

  var tabContainers = document.querySelectorAll("[data-tabs]");
  if (tabContainers.length) {
    tabContainers.forEach(function (container) {
      var tabs = Array.from(container.querySelectorAll('[role="tab"][data-tab-target]'));
      var panels = Array.from(container.querySelectorAll("[data-tab-panel]"));
      if (!tabs.length || !panels.length) return;

      function activateTab(tab, moveFocus) {
        var targetId = tab.getAttribute("data-tab-target");
        tabs.forEach(function (item) {
          var isActive = item === tab;
          item.setAttribute("aria-selected", isActive ? "true" : "false");
          item.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        panels.forEach(function (panel) {
          panel.hidden = panel.id !== targetId;
        });

        if (moveFocus) tab.focus();
      }

      tabs.forEach(function (tab, index) {
        tab.addEventListener("click", function () {
          activateTab(tab, false);
        });

        tab.addEventListener("keydown", function (event) {
          var nextIndex = index;
          if (event.key === "ArrowRight") {
            nextIndex = (index + 1) % tabs.length;
          } else if (event.key === "ArrowLeft") {
            nextIndex = (index - 1 + tabs.length) % tabs.length;
          } else if (event.key === "Home") {
            nextIndex = 0;
          } else if (event.key === "End") {
            nextIndex = tabs.length - 1;
          } else {
            return;
          }

          event.preventDefault();
          activateTab(tabs[nextIndex], true);
        });
      });

      var initiallySelected = container.querySelector('[role="tab"][aria-selected="true"]') || tabs[0];
      activateTab(initiallySelected, false);
    });
  }

  var modal = document.getElementById("adminModal");
  var modalDialog = modal ? modal.querySelector(".admin-modal-dialog") : null;
  var modalBody = modal ? modal.querySelector(".admin-modal-body") : null;
  var modalTitle = document.getElementById("adminModalTitle");
  var modalLoading = document.getElementById("adminModalLoading");
  var modalMessage = document.getElementById("adminModalMessage");
  var modalCancel = document.getElementById("adminModalCancel");
  var modalConfirm = document.getElementById("adminModalConfirm");
  var modalCloseEls = modal ? modal.querySelectorAll("[data-modal-close]") : [];
  var modalState = null;
  var lastFocus = null;

  function resetModal() {
    if (!modal || !modalDialog || !modalBody || !modalMessage || !modalCancel || !modalConfirm) return;

    modal.dataset.mode = "confirm";
    if (modalLoading) {
      modalLoading.setAttribute("hidden", "");
      modalLoading.setAttribute("aria-hidden", "true");
    }
    modalMessage.removeAttribute("hidden");
    modalBody.classList.remove("admin-modal-body-loading");
    modalCancel.removeAttribute("hidden");
    modalConfirm.removeAttribute("hidden");
  }

  function canDismissModal() {
    return Boolean(modalState && modalState.dismissible !== false);
  }

  function closeModal(result) {
    if (!modal || !modalState) return;
    var resolver = modalState.resolve;
    modalState = null;
    resetModal();
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    if (typeof resolver === "function") {
      resolver(Boolean(result));
    }
  }

  function openModal(options) {
    options = options || {};
    var isLoading = options.mode === "loading";

    if (!modal || !modalDialog || !modalTitle || !modalMessage || !modalConfirm || !modalCancel) {
      if (isLoading) {
        return Promise.resolve(false);
      }
      return Promise.resolve(window.confirm(options.message || "Are you sure?"));
    }

    if (modalState) {
      if (typeof modalState.resolve === "function") {
        modalState.resolve(false);
      }
      modalState = null;
    }

    resetModal();
    lastFocus = document.activeElement;
    modalTitle.textContent = options.title || "Confirm Action";
    modalMessage.textContent = options.message || "Are you sure you want to continue?";
    modalConfirm.textContent = options.confirmText || "Confirm";
    modalCancel.textContent = options.cancelText || "Cancel";
    modalConfirm.className = "btn " + (options.confirmVariant === "primary" ? "btn-primary" : "btn-danger");

    if (isLoading) {
      modal.dataset.mode = "loading";
      if (modalLoading) {
        modalLoading.removeAttribute("hidden");
        modalLoading.setAttribute("aria-hidden", "false");
      }
      modalCancel.setAttribute("hidden", "");
      modalConfirm.setAttribute("hidden", "");
    }

    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    return new Promise(function (resolve) {
      modalState = {
        resolve: resolve,
        dismissible: options.dismissible !== false && !isLoading,
      };
      setTimeout(function () {
        modalDialog.focus();
      }, 0);
    });
  }

  window.showConfirm = function (options) {
    return openModal(options || {});
  };

  window.showAlert = function (options) {
    options = options || {};
    return openModal({
      title: options.title || "Notice",
      message: options.message || "",
      confirmText: options.confirmText || "OK",
      cancelText: "Close",
      confirmVariant: "primary",
    });
  };

  window.showLoadingModal = function (options) {
    options = options || {};
    return openModal({
      title: options.title || "Working",
      message: options.message || "Please wait while we prepare your request.",
      mode: "loading",
      dismissible: false,
    });
  };

  window.hideModal = function () {
    closeModal(false);
  };

  if (modal) {
    if (modalCancel) {
      modalCancel.addEventListener("click", function () {
        if (!canDismissModal()) return;
        closeModal(false);
      });
    }

    if (modalConfirm) {
      modalConfirm.addEventListener("click", function () {
        if (!canDismissModal()) return;
        closeModal(true);
      });
    }

    modalCloseEls.forEach(function (el) {
      el.addEventListener("click", function () {
        if (!canDismissModal()) return;
        closeModal(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (!modalState) return;
      if (event.key === "Escape") {
        if (!canDismissModal()) return;
        event.preventDefault();
        closeModal(false);
      }
    });
  }

  document.addEventListener(
    "submit",
    function (event) {
      var form = event.target;
      if (!form || !form.matches || !form.matches("form[data-confirm-message]")) return;
      if (form.dataset.confirmed === "true") return;

      event.preventDefault();

      var options = {
        title: form.getAttribute("data-confirm-title") || "Confirm Action",
        message: form.getAttribute("data-confirm-message") || "Are you sure you want to continue?",
        confirmText: form.getAttribute("data-confirm-button") || "Confirm",
        cancelText: form.getAttribute("data-cancel-button") || "Cancel",
        confirmVariant: form.getAttribute("data-confirm-variant") || "danger",
      };

      openModal(options).then(function (confirmed) {
        if (!confirmed) return;
        form.dataset.confirmed = "true";
        form.submit();
      });
    },
    true,
  );

  var activeDownload = null;

  function createDownloadToken() {
    return "dl" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getCookieValue(name) {
    var escaped = name.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1");
    var match = document.cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function clearCookie(name) {
    document.cookie = name + "=; Max-Age=0; path=/; SameSite=Strict";
  }

  function getDownloadFrame() {
    var frame = document.getElementById("adminDownloadFrame");
    if (frame) return frame;

    frame = document.createElement("iframe");
    frame.id = "adminDownloadFrame";
    frame.name = "adminDownloadFrame";
    frame.hidden = true;
    frame.tabIndex = -1;
    document.body.appendChild(frame);
    return frame;
  }

  function handleDownloadLink(link) {
    if (activeDownload) {
      if (typeof window.showToast === "function") {
        window.showToast("A download is already being prepared.", "info");
      }
      return;
    }

    var token = createDownloadToken();
    var downloadUrl = new URL(link.href, window.location.origin);
    downloadUrl.searchParams.set("downloadToken", token);

    if (typeof window.showLoadingModal === "function") {
      window.showLoadingModal({
        title: link.getAttribute("data-download-title") || "Preparing download",
        message: link.getAttribute("data-download-message") || "Please wait while your file is being prepared.",
      });
    }

    var frame = getDownloadFrame();
    var state = {
      token: token,
      frame: frame,
      completed: false,
      pollId: null,
      timeoutId: null,
      loadHandler: null,
    };

    function cleanup() {
      if (state.pollId) {
        window.clearInterval(state.pollId);
      }
      if (state.timeoutId) {
        window.clearTimeout(state.timeoutId);
      }
      if (state.loadHandler) {
        state.frame.removeEventListener("load", state.loadHandler);
      }
      activeDownload = null;
    }

    state.loadHandler = function () {
      if (state.completed) return;

      try {
        var doc = state.frame.contentDocument;
        var text = doc && doc.body ? doc.body.textContent.trim() : "";
        if (!text) return;
      } catch (_error) {
        return;
      }

      cleanup();
      if (typeof window.hideModal === "function") {
        window.hideModal();
      }
      if (typeof window.showAlert === "function") {
        window.showAlert({
          title: "Download failed",
          message: "We couldn't start the ZIP export. Please try again.",
          confirmText: "Close",
        });
      }
    };

    state.pollId = window.setInterval(function () {
      if (getCookieValue("pd_download") !== token) return;

      state.completed = true;
      clearCookie("pd_download");
      cleanup();

      if (typeof window.hideModal === "function") {
        window.hideModal();
      }
      if (typeof window.showToast === "function") {
        window.showToast("Download started.", "success");
      }
    }, 250);

    state.timeoutId = window.setTimeout(function () {
      if (state.completed) return;
      cleanup();

      if (typeof window.hideModal === "function") {
        window.hideModal();
      }
      if (typeof window.showAlert === "function") {
        window.showAlert({
          title: "Still preparing export",
          message: "The ZIP export is taking longer than expected. Please wait a moment and try again if the download does not start.",
          confirmText: "Close",
        });
      }
    }, 45000);

    activeDownload = state;
    state.frame.addEventListener("load", state.loadHandler);
    state.frame.src = downloadUrl.toString();
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    var link = event.target.closest ? event.target.closest("a[data-download-link]") : null;
    if (!link) return;

    event.preventDefault();
    handleDownloadLink(link);
  });

  function isSaveShortcut(event) {
    if (event.defaultPrevented) return false;
    if (!(event.ctrlKey || event.metaKey)) return false;
    return event.key === "s" || event.key === "S" || event.code === "KeyS";
  }

  function isEligibleSaveForm(form) {
    if (!form || form.tagName !== "FORM") return false;
    if (form.classList.contains("inline-form")) return false;
    if (form.classList.contains("auth-form")) return false;
    if (form.hasAttribute("data-confirm-message")) return false;
    if (form.getAttribute("data-save-shortcut") === "off") return false;

    var method = (form.getAttribute("method") || "GET").toUpperCase();
    return method === "POST";
  }

  function resolveSaveTargetForm() {
    var activeElement = document.activeElement;
    if (activeElement && typeof activeElement.closest === "function") {
      var focusedForm = activeElement.closest("form");
      if (isEligibleSaveForm(focusedForm)) {
        return focusedForm;
      }
    }

    var fallback = document.querySelector("main.admin-content form[method='POST']:not(.inline-form):not(.auth-form):not([data-confirm-message]):not([data-save-shortcut='off'])");
    return fallback || null;
  }

  document.addEventListener("keydown", function (event) {
    if (!isSaveShortcut(event)) return;

    var form = resolveSaveTargetForm();
    if (!form) return;

    event.preventDefault();
    queueNextPageToast("Saved changes", "success");
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.submit();
  });

  var insertIpLink = document.getElementById("insert-my-ip");
  if (insertIpLink) {
    insertIpLink.addEventListener("click", function (event) {
      event.preventDefault();
      var ip = insertIpLink.getAttribute("data-ip");
      var textarea = document.getElementById("allowedIps");
      if (!ip || !textarea) return;

      var current = textarea.value.trim();
      var lines = current
        ? current.split(/\r?\n/).map(function (l) {
            return l.trim();
          })
        : [];
      if (lines.indexOf(ip) !== -1) return;

      textarea.value = current ? current + "\n" + ip : ip;
      textarea.focus();
    });
  }
})();
