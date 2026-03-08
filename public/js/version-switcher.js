(function () {
  var select = document.getElementById("versionSelect");
  if (!select) return;

  select.addEventListener("change", function () {
    var projectSlug = select.dataset.project;
    var versionSlug = select.value;
    window.location.href = "/docs/" + encodeURIComponent(projectSlug) + "/" + encodeURIComponent(versionSlug);
  });
})();
