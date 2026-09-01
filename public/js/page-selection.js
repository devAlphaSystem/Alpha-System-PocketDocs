(function () {
  var form = document.querySelector("[data-page-batch-delete-form]");
  if (!form) return;

  var checkboxes = [];

  var itemLabel = form.dataset.itemLabel || "page";
  var itemLabelPlural = form.dataset.itemLabelPlural || itemLabel + "s";
  var countElement = form.querySelector("[data-page-selection-count]");
  var labelElement = form.querySelector("[data-page-selection-label]");
  var resetButton = form.querySelector("[data-page-selection-reset]");
  var lastClickedCheckbox = null;

  function handleCheckboxClick(event) {
    var checkbox = event.currentTarget;

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
  }

  function refreshCheckboxes() {
    checkboxes = Array.from(document.querySelectorAll("[data-page-select]"));
    checkboxes.forEach(function (checkbox) {
      if (checkbox.dataset.pageSelectionReady === "true") return;
      checkbox.dataset.pageSelectionReady = "true";
      checkbox.addEventListener("click", handleCheckboxClick);
    });
    updateSelectionState();
  }

  function updateSelectionState() {
    var selectedCount = 0;

    checkboxes.forEach(function (checkbox) {
      if (checkbox.checked) selectedCount += 1;
      var row = checkbox.closest(".version-card");
      if (row) row.classList.toggle("page-selected", checkbox.checked);
    });

    if (countElement) countElement.textContent = String(selectedCount);
    if (labelElement) labelElement.textContent = selectedCount === 1 ? itemLabel : itemLabelPlural;
    form.hidden = selectedCount === 0;
    form.setAttribute("data-confirm-title", "Remove selected " + (selectedCount === 1 ? itemLabel : itemLabelPlural) + "?");
    form.setAttribute("data-confirm-message", "Remove " + selectedCount + " selected " + (selectedCount === 1 ? itemLabel : itemLabelPlural) + "? This cannot be undone.");
  }

  if (resetButton) {
    resetButton.addEventListener("click", function () {
      checkboxes.forEach(function (checkbox) {
        checkbox.checked = false;
      });
      lastClickedCheckbox = null;
      updateSelectionState();
    });
  }

  document.addEventListener("pocketdocs:items-loaded", refreshCheckboxes);
  refreshCheckboxes();
})();
