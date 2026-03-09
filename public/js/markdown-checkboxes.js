(function () {
  var checkboxes = document.querySelectorAll(".docs-content input[type='checkbox']");
  if (!checkboxes.length) return;

  checkboxes.forEach(function (checkbox) {
    checkbox.disabled = false;
    checkbox.removeAttribute("disabled");
  });
})();
