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
    var overlayQuery = window.matchMedia(options.overlayMediaQuery || "(max-width: 768px)");
    var edgeZone = options.edgeZone || 52;
    var minDistance = options.minDistance || 48;
    var maxVerticalDistance = options.maxVerticalDistance || 140;
    var lockInDistance = options.lockInDistance || 8;
    var verticalCancelDistance = options.verticalCancelDistance || 20;
    var reverseCancelDistance = options.reverseCancelDistance || 32;
    var gesture = null;

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

    function openSidebar() {
      if (!isOverlayMode()) return;
      sidebar.classList.add("open");
      syncToggleState();
    }

    function closeSidebar() {
      sidebar.classList.remove("open");
      syncToggleState();
    }

    function toggleSidebar() {
      if (isOpen()) {
        closeSidebar();
        return;
      }
      openSidebar();
    }

    sidebar.dataset.swipeSidebarReady = "true";
    syncToggleState();

    if (toggle) {
      toggle.addEventListener("click", function () {
        toggleSidebar();
      });
    }

    document.addEventListener("click", function (event) {
      if (!isOverlayMode() || !isOpen()) return;
      if (sidebar.contains(event.target)) return;
      if (toggle && toggle.contains(event.target)) return;
      closeSidebar();
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
          var canOpen = !isOpen() && startX <= edgeZone;
          var canClose = isOpen() && (sidebar.contains(event.target) || startX <= Math.min(window.innerWidth, sidebarRect.right + edgeZone));

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
          var deltaX = touch.clientX - gesture.startX;
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

          var deltaX = touch.clientX - gesture.startX;
          var deltaY = touch.clientY - gesture.startY;
          var isMostlyHorizontal = Math.abs(deltaY) <= maxVerticalDistance;

          if (gesture.mode === "open" && deltaX >= minDistance && isMostlyHorizontal) {
            openSidebar();
          }

          if (gesture.mode === "close" && deltaX <= -minDistance && isMostlyHorizontal) {
            closeSidebar();
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
        closeSidebar();
      }
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
    overlayMediaQuery: "(max-width: 768px)",
  });
})();
