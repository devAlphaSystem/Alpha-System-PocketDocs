(function () {
  var input = document.getElementById("docsSearch");
  var resultsContainer = document.getElementById("searchResults");
  if (!input || !resultsContainer) return;

  var projectSlug = input.dataset.project;
  var versionId = input.dataset.version;
  var debounceTimer = null;

  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    var query = input.value.trim();
    if (query.length < 2) {
      resultsContainer.classList.remove("active");
      resultsContainer.innerHTML = "";
      return;
    }
    debounceTimer = setTimeout(function () {
      fetchResults(query);
    }, 300);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      resultsContainer.classList.remove("active");
    }
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.classList.remove("active");
    }
  });

  function fetchResults(query) {
    var url = "/api/search?project=" + encodeURIComponent(projectSlug) + "&version=" + encodeURIComponent(versionId) + "&q=" + encodeURIComponent(query);
    fetch(url)
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (!data.results || data.results.length === 0) {
          resultsContainer.innerHTML = '<div class="search-results-item"><span>No results found</span></div>';
        } else {
          resultsContainer.innerHTML = data.results
            .map(function (r) {
              var safeTitle = escapeHtml(r.title);
              var safeSlug = escapeHtml(r.slug);
              return '<a href="/docs/' + escapeHtml(projectSlug) + "/" + escapeHtml(r.versionSlug || "") + "/" + safeSlug + '" class="search-results-item"><strong>' + safeTitle + "</strong><span>/" + safeSlug + "</span></a>";
            })
            .join("");
        }
        resultsContainer.classList.add("active");
      })
      .catch(function () {
        resultsContainer.classList.remove("active");
      });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
