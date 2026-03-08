(function () {
  var tree = document.getElementById("pagesTree");
  if (!tree) return;

  var projectId = tree.dataset.project;
  var versionId = tree.dataset.version;
  var csrfToken = tree.dataset.csrf;
  var dragItem = null;

  tree.addEventListener("dragstart", function (e) {
    var item = e.target.closest(".page-tree-item");
    if (!item) return;
    dragItem = item;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.dataset.id);
  });

  tree.addEventListener("dragend", function () {
    if (dragItem) {
      dragItem.classList.remove("dragging");
      dragItem = null;
    }
    tree.querySelectorAll(".drag-over").forEach(function (el) {
      el.classList.remove("drag-over");
    });
  });

  tree.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    var item = e.target.closest(".page-tree-item");
    if (!item || item === dragItem) return;
    tree.querySelectorAll(".drag-over").forEach(function (el) {
      el.classList.remove("drag-over");
    });
    item.classList.add("drag-over");
  });

  tree.addEventListener("dragleave", function (e) {
    var item = e.target.closest(".page-tree-item");
    if (item) item.classList.remove("drag-over");
  });

  tree.addEventListener("drop", function (e) {
    e.preventDefault();
    var target = e.target.closest(".page-tree-item");
    if (!target || !dragItem || target === dragItem) return;

    target.parentNode.insertBefore(dragItem, target);

    var items = tree.querySelectorAll(".page-tree-item");
    var pages = [];
    items.forEach(function (el, index) {
      pages.push({ id: el.dataset.id, order: index });
    });

    fetch("/admin/projects/" + encodeURIComponent(projectId) + "/versions/" + encodeURIComponent(versionId) + "/pages/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ pages: pages }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Reorder failed");
        if (typeof window.showToast === "function") {
          window.showToast("Pages reordered", "success");
        }
      })
      .catch(function () {
        if (typeof window.showToast === "function") {
          window.showToast("Failed to reorder pages", "error");
        }
        window.location.reload();
      });
  });
})();
