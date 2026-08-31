(function () {
  var createDialog = document.querySelector("[data-sidebar-item-create-dialog]");
  if (createDialog) {
    var itemTypeSelect = createDialog.querySelector("[data-sidebar-item-type]");
    var titleGroup = createDialog.querySelector("[data-sidebar-item-title-group]");
    var createTitleInput = createDialog.querySelector("[data-sidebar-item-title]");
    var itemHelp = createDialog.querySelector("[data-sidebar-item-help]");

    function updateCreateFields() {
      if (!itemTypeSelect || !titleGroup || !createTitleInput) return;
      var isHeader = itemTypeSelect.value === "header";
      titleGroup.hidden = !isHeader;
      createTitleInput.required = isHeader;
      if (itemHelp) {
        itemHelp.textContent = isHeader ? "A header is displayed as a non-clickable label in the public sidebar." : "A separator is displayed as a horizontal line in the public sidebar.";
      }
    }

    if (itemTypeSelect) {
      itemTypeSelect.addEventListener("change", updateCreateFields);
      updateCreateFields();
    }
  }

  var dialog = document.querySelector("[data-sidebar-header-dialog]");
  if (!dialog) return;

  var form = dialog.querySelector("[data-sidebar-header-edit-form]");
  var titleInput = dialog.querySelector("[data-sidebar-header-title]");
  if (!form || !titleInput) return;

  document.querySelectorAll("[data-sidebar-header-edit]").forEach(function (button) {
    button.addEventListener("click", function () {
      form.action = button.dataset.editUrl || "";
      titleInput.value = button.dataset.headerTitle || "";
      window.requestAnimationFrame(function () {
        titleInput.focus();
        titleInput.select();
      });
    });
  });
})();
