(function () {
  function supportsTouchInput() {
    return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  }

  function initSwipeSidebar(options) {
    options = options || {};

    var sidebar = document.querySelector(options.sidebarSelector);
    if (!sidebar || sidebar.dataset.swipeSidebarReady === "true") {
      return null;
    }

    var toggle = options.toggleSelector ? document.querySelector(options.toggleSelector) : null;
    var opensFromRight = window.getComputedStyle(sidebar).direction === "rtl";
    var overlayQuery = window.matchMedia(options.overlayMediaQuery || "(max-width: 768px)");
    var edgeZone = options.edgeZone || 52;
    var minDistance = options.minDistance || 48;
    var maxVerticalDistance = options.maxVerticalDistance || 140;
    var lockInDistance = options.lockInDistance || 8;
    var verticalCancelDistance = options.verticalCancelDistance || 20;
    var reverseCancelDistance = options.reverseCancelDistance || 32;
    var gesture = null;
    var previouslyFocused = null;
    var backdrop = document.createElement("button");

    backdrop.type = "button";
    backdrop.className = "sidebar-backdrop";
    backdrop.setAttribute("aria-label", sidebar.dataset.closeLabel || "Close navigation");
    backdrop.setAttribute("tabindex", "-1");
    backdrop.hidden = true;
    sidebar.insertAdjacentElement("afterend", backdrop);

    if (!sidebar.hasAttribute("tabindex")) {
      sidebar.setAttribute("tabindex", "-1");
    }

    function isOverlayMode() {
      return overlayQuery.matches;
    }

    function isOpen() {
      return sidebar.classList.contains("open");
    }

    function syncToggleState() {
      if (!toggle) return;
      toggle.setAttribute("aria-expanded", isOpen() ? "true" : "false");
      if (!toggle.getAttribute("aria-controls") && sidebar.id) {
        toggle.setAttribute("aria-controls", sidebar.id);
      }
    }

    function syncSidebarAvailability() {
      var unavailable = isOverlayMode() && !isOpen();
      if (unavailable && sidebar.contains(document.activeElement) && toggle && typeof toggle.focus === "function") {
        toggle.focus({ preventScroll: true });
      }
      sidebar.toggleAttribute("inert", unavailable);
      if (unavailable) {
        sidebar.setAttribute("aria-hidden", "true");
      } else {
        sidebar.removeAttribute("aria-hidden");
      }
    }

    function getFocusableElements() {
      return Array.prototype.filter.call(sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (element) {
        return !element.hidden && element.getClientRects().length > 0;
      });
    }

    function openSidebar() {
      if (!isOverlayMode()) return;
      previouslyFocused = document.activeElement;
      sidebar.classList.add("open");
      backdrop.hidden = false;
      document.body.classList.add("sidebar-overlay-open");
      syncToggleState();
      syncSidebarAvailability();
      sidebar.focus({ preventScroll: true });
    }

    function closeSidebar(restoreFocus) {
      if (restoreFocus && toggle && typeof toggle.focus === "function") {
        toggle.focus({ preventScroll: true });
      } else if (restoreFocus && previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
      sidebar.classList.remove("open");
      backdrop.hidden = true;
      document.body.classList.remove("sidebar-overlay-open");
      syncToggleState();
      syncSidebarAvailability();
      previouslyFocused = null;
    }

    function toggleSidebar() {
      if (isOpen()) {
        closeSidebar(false);
        return;
      }
      openSidebar();
    }

    sidebar.dataset.swipeSidebarReady = "true";
    syncToggleState();
    syncSidebarAvailability();

    if (toggle) {
      toggle.addEventListener("click", function () {
        toggleSidebar();
      });
    }

    backdrop.addEventListener("click", function () {
      closeSidebar(true);
    });

    document.addEventListener("keydown", function (event) {
      if (!isOverlayMode() || !isOpen()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeSidebar(true);
        return;
      }

      if (event.key !== "Tab") return;

      var focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        sidebar.focus({ preventScroll: true });
        return;
      }

      var firstElement = focusableElements[0];
      var lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === firstElement || document.activeElement === sidebar)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (!isOverlayMode() || !isOpen()) return;
      if (sidebar.contains(event.target)) return;
      if (toggle && toggle.contains(event.target)) return;
      closeSidebar(event.target === backdrop);
    });

    function resetGesture() {
      gesture = null;
    }

    if (supportsTouchInput()) {
      document.addEventListener(
        "touchstart",
        function (event) {
          if (!isOverlayMode() || event.touches.length !== 1) {
            resetGesture();
            return;
          }

          var touch = event.touches[0];
          var startX = touch.clientX;
          var startY = touch.clientY;
          var sidebarRect = sidebar.getBoundingClientRect();
          var atEdge = opensFromRight ? startX >= window.innerWidth - edgeZone : startX <= edgeZone;
          var nearSidebar = opensFromRight ? startX >= Math.max(0, sidebarRect.left - edgeZone) : startX <= Math.min(window.innerWidth, sidebarRect.right + edgeZone);
          var canOpen = !isOpen() && atEdge;
          var canClose = isOpen() && (sidebar.contains(event.target) || nearSidebar);

          if (!canOpen && !canClose) {
            resetGesture();
            return;
          }

          gesture = {
            mode: isOpen() ? "close" : "open",
            startX: startX,
            startY: startY,
            engaged: false,
          };
        },
        { passive: true },
      );

      document.addEventListener(
        "touchmove",
        function (event) {
          if (!gesture || !isOverlayMode()) return;

          var touch = event.touches[0];
          var deltaX = (touch.clientX - gesture.startX) * (opensFromRight ? -1 : 1);
          var deltaY = touch.clientY - gesture.startY;
          var absX = Math.abs(deltaX);
          var absY = Math.abs(deltaY);

          if (!gesture.engaged) {
            if (absY > absX) {
              if (absY > verticalCancelDistance) {
                resetGesture();
              }
              return;
            }

            if (absX < lockInDistance) {
              return;
            }

            if ((gesture.mode === "open" && deltaX <= 0) || (gesture.mode === "close" && deltaX >= 0)) {
              if (absX > reverseCancelDistance) {
                resetGesture();
              }
              return;
            }

            gesture.engaged = true;
          }

          event.preventDefault();
        },
        { passive: false },
      );

      document.addEventListener(
        "touchend",
        function (event) {
          if (!gesture || !isOverlayMode()) {
            resetGesture();
            return;
          }

          var touch = event.changedTouches[0];
          if (!touch) {
            resetGesture();
            return;
          }

          var deltaX = (touch.clientX - gesture.startX) * (opensFromRight ? -1 : 1);
          var deltaY = touch.clientY - gesture.startY;
          var isMostlyHorizontal = Math.abs(deltaY) <= maxVerticalDistance;

          if (gesture.mode === "open" && deltaX >= minDistance && isMostlyHorizontal) {
            openSidebar();
          }

          if (gesture.mode === "close" && deltaX <= -minDistance && isMostlyHorizontal) {
            closeSidebar(true);
          }

          resetGesture();
        },
        { passive: true },
      );

      document.addEventListener(
        "touchcancel",
        function () {
          resetGesture();
        },
        { passive: true },
      );
    }

    function handleViewportChange(event) {
      if (!event.matches) {
        closeSidebar(false);
        return;
      }
      syncSidebarAvailability();
    }

    if (typeof overlayQuery.addEventListener === "function") {
      overlayQuery.addEventListener("change", handleViewportChange);
    } else if (typeof overlayQuery.addListener === "function") {
      overlayQuery.addListener(handleViewportChange);
    }

    return {
      open: openSidebar,
      close: closeSidebar,
      toggle: toggleSidebar,
    };
  }

  window.initSwipeSidebar = initSwipeSidebar;

  initSwipeSidebar({
    sidebarSelector: ".admin-sidebar",
    toggleSelector: ".sidebar-toggle",
    overlayMediaQuery: "(max-width: 768px)",
  });

  initSwipeSidebar({
    sidebarSelector: ".docs-sidebar",
    toggleSelector: ".docs-sidebar-toggle",
    overlayMediaQuery: "(max-width: 768px)",
  });
})();
