(function () {
  var STORAGE_KEY = "pd_theme";

  function getPreferred() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    var btns = document.querySelectorAll(".theme-toggle-btn");
    btns.forEach(function (btn) {
      var icon = btn.querySelector("i");
      if (icon) {
        icon.className = theme === "dark" ? "ph ph-sun" : "ph ph-moon";
      }
    });
  }

  apply(getPreferred());

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".theme-toggle-btn");
    if (!btn) return;
    var current = document.documentElement.getAttribute("data-theme");
    apply(current === "dark" ? "light" : "dark");
  });
})();
