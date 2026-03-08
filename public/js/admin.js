(function () {
  var sidebar = document.querySelector(".admin-sidebar");
  var toggle = document.querySelector(".sidebar-toggle");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (sidebar.classList.contains("open") && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove("open");
      }
    });
  }

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
})();
