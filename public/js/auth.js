(function () {
  document.querySelectorAll(".password-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      var input = button.parentElement.querySelector("input");
      var icon = button.querySelector("i");
      if (!input || !icon) return;

      if (input.type === "password") {
        input.type = "text";
        icon.className = "ph ph-eye-slash";
      } else {
        input.type = "password";
        icon.className = "ph ph-eye";
      }
    });
  });
})();
