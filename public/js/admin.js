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
  var modalTitle = document.getElementById("adminModalTitle");
  var modalMessage = document.getElementById("adminModalMessage");
  var modalCancel = document.getElementById("adminModalCancel");
  var modalConfirm = document.getElementById("adminModalConfirm");
  var modalCloseEls = modal ? modal.querySelectorAll("[data-modal-close]") : [];
  var modalState = null;
  var lastFocus = null;

  function closeModal(result) {
    if (!modal || !modalState) return;
    var resolver = modalState.resolve;
    modalState = null;
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
    if (!modal || !modalDialog || !modalTitle || !modalMessage || !modalConfirm || !modalCancel) {
      return Promise.resolve(window.confirm(options.message || "Are you sure?"));
    }

    if (modalState) {
      modalState.resolve(false);
      modalState = null;
    }

    lastFocus = document.activeElement;
    modalTitle.textContent = options.title || "Confirm Action";
    modalMessage.textContent = options.message || "Are you sure you want to continue?";
    modalConfirm.textContent = options.confirmText || "Confirm";
    modalCancel.textContent = options.cancelText || "Cancel";
    modalConfirm.className = "btn " + (options.confirmVariant === "primary" ? "btn-primary" : "btn-danger");

    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    return new Promise(function (resolve) {
      modalState = { resolve: resolve };
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

  if (modal) {
    if (modalCancel) {
      modalCancel.addEventListener("click", function () {
        closeModal(false);
      });
    }

    if (modalConfirm) {
      modalConfirm.addEventListener("click", function () {
        closeModal(true);
      });
    }

    modalCloseEls.forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (!modalState) return;
      if (event.key === "Escape") {
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
