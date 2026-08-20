(function () {
  var form = document.querySelector("[data-page-batch-delete-form]");
  if (!form) return;

  var checkboxes = Array.from(document.querySelectorAll("[data-page-select]"));
  if (!checkboxes.length) return;

  var itemLabel = form.dataset.itemLabel || "page";
  var itemLabelPlural = form.dataset.itemLabelPlural || itemLabel + "s";
  var lastClickedCheckbox = null;

  function updateSelectionState() {
    var selectedCount = 0;

    checkboxes.forEach(function (checkbox) {
      if (checkbox.checked) selectedCount += 1;
      var row = checkbox.closest(".version-card");
      if (row) row.classList.toggle("page-selected", checkbox.checked);
    });

    form.hidden = selectedCount === 0;
    form.setAttribute("data-confirm-title", "Remove selected " + (selectedCount === 1 ? itemLabel : itemLabelPlural) + "?");
    form.setAttribute("data-confirm-message", "Remove " + selectedCount + " selected " + (selectedCount === 1 ? itemLabel : itemLabelPlural) + "? This cannot be undone.");
  }

  checkboxes.forEach(function (checkbox) {
    checkbox.addEventListener("click", function (event) {
      if (event.shiftKey && lastClickedCheckbox) {
        var currentIndex = checkboxes.indexOf(checkbox);
        var previousIndex = checkboxes.indexOf(lastClickedCheckbox);
        var rangeStart = Math.min(currentIndex, previousIndex);
        var rangeEnd = Math.max(currentIndex, previousIndex);

        for (var index = rangeStart; index <= rangeEnd; index += 1) {
          checkboxes[index].checked = checkbox.checked;
        }
      }

      lastClickedCheckbox = checkbox;
      updateSelectionState();
    });
  });

  updateSelectionState();
})();
