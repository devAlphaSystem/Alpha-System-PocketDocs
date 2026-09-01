(function () {
  var STORAGE_KEY = "pd_theme";
  var systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  function getPreferred() {
    var stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" || stored === "auto" ? stored : "auto";
  }

  function resolve(preference) {
    return preference === "auto" ? (systemTheme.matches ? "dark" : "light") : preference;
  }

  function apply(preference, persist) {
    var theme = resolve(preference);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-theme-preference", preference);
    if (persist !== false) {
      localStorage.setItem(STORAGE_KEY, preference);
    }

    var btns = document.querySelectorAll(".theme-toggle-btn");
    btns.forEach(function (btn) {
      var icon = btn.querySelector("i");
      if (icon) {
        icon.className = theme === "dark" ? "ph ph-sun" : "ph ph-moon";
      }
    });

    document.querySelectorAll("[data-theme-value]").forEach(function (option) {
      var isActive = option.getAttribute("data-theme-value") === preference;
      option.classList.toggle("active", isActive);
      option.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  apply(getPreferred(), false);

  document.addEventListener("click", function (e) {
    var option = e.target.closest("[data-theme-value]");
    if (option) {
      apply(option.getAttribute("data-theme-value"));
      var menu = option.closest("details");
      if (menu) menu.removeAttribute("open");
      return;
    }

    var btn = e.target.closest(".theme-toggle-btn");
    if (!btn) return;
    if (btn.closest(".theme-menu")) return;

    var current = document.documentElement.getAttribute("data-theme");
    apply(current === "dark" ? "light" : "dark");
  });

  function handleSystemThemeChange() {
    if (getPreferred() === "auto") {
      apply("auto", false);
    }
  }

  if (typeof systemTheme.addEventListener === "function") {
    systemTheme.addEventListener("change", handleSystemThemeChange);
  } else if (typeof systemTheme.addListener === "function") {
    systemTheme.addListener(handleSystemThemeChange);
  }
})();
