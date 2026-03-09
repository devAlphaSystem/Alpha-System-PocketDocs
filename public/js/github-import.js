(function () {
  "use strict";

  var state = {
    owner: "",
    repo: "",
    repoUrl: "",
    selectedRefs: new Map(),
    repoPage: 1,
    tagPage: 1,
    commitPage: 1,
    autoSlug: true,
  };

  var repoUrlInput = document.getElementById("gh-repo-url");
  var fetchBtn = document.getElementById("gh-fetch-btn");
  var loadReposBtn = document.getElementById("gh-load-repos-btn");
  var repoList = document.getElementById("gh-repo-list");
  var loadMoreReposBtn = document.getElementById("gh-load-more-repos");
  var repoInfo = document.getElementById("gh-repo-info");
  var stepVersions = document.getElementById("gh-step-versions");
  var stepDetails = document.getElementById("gh-step-details");
  var importBtn = document.getElementById("gh-import-btn");
  var importCountSpan = document.getElementById("gh-import-count");
  var progressWrap = document.getElementById("gh-progress");
  var progressFill = document.getElementById("gh-progress-fill");
  var progressText = document.getElementById("gh-progress-text");
  var manualSubmitBtn = document.getElementById("manual-submit-btn");
  var projectNameInput = document.getElementById("gh-project-name");
  var projectSlugInput = document.getElementById("gh-project-slug");

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str || ""));
    return div.innerHTML;
  }

  async function api(url, options) {
    var res = await fetch(url, options);
    if (!res.ok) {
      var body = await res.json().catch(function () {
        return {};
      });
      throw new Error(body.error?.message || "Request failed: " + res.status);
    }
    return res.json();
  }

  function updateHeaderActions() {
    var ghTab = document.getElementById("tab-github");
    if (!ghTab) return;
    var isGithubActive = ghTab.getAttribute("aria-selected") === "true";
    if (manualSubmitBtn) manualSubmitBtn.style.display = isGithubActive ? "none" : "";
  }

  var tabButtons = document.querySelectorAll('[role="tab"]');
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setTimeout(updateHeaderActions, 50);
    });
  });

  fetchBtn.addEventListener("click", async function () {
    var url = repoUrlInput.value.trim();
    if (!url) return;
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Fetching...';
    try {
      var data = await api("/admin/github/repo-info?url=" + encodeURIComponent(url));
      showRepoInfo(data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="ph ph-magnifying-glass"></i> Fetch';
    }
  });

  repoUrlInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchBtn.click();
    }
  });

  loadReposBtn.addEventListener("click", async function () {
    loadReposBtn.disabled = true;
    loadReposBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Loading...';
    try {
      state.repoPage = 1;
      var repos = await api("/admin/github/repos?page=1");
      renderRepoList(repos, false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      loadReposBtn.disabled = false;
      loadReposBtn.innerHTML = '<i class="ph ph-list"></i> Load my repositories';
    }
  });

  loadMoreReposBtn.addEventListener("click", async function () {
    loadMoreReposBtn.disabled = true;
    try {
      state.repoPage++;
      var repos = await api("/admin/github/repos?page=" + state.repoPage);
      renderRepoList(repos, true);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      loadMoreReposBtn.disabled = false;
    }
  });

  function renderRepoList(repos, append) {
    repoList.hidden = false;
    if (!append) repoList.innerHTML = "";

    if (repos.length === 0 && !append) {
      repoList.innerHTML = '<p class="gh-empty">No repositories found.</p>';
      loadMoreReposBtn.hidden = true;
      return;
    }

    repos.forEach(function (r) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "gh-repo-item";
      item.innerHTML = '<div class="gh-repo-item-name">' + '<i class="ph ph-' + (r.private ? "lock" : "globe") + '"></i> ' + escapeHtml(r.full_name) + "</div>" + '<div class="gh-repo-item-desc">' + escapeHtml(r.description || "No description") + "</div>";
      item.addEventListener("click", function () {
        repoUrlInput.value = r.html_url;
        showRepoInfo(r);
      });
      repoList.appendChild(item);
    });

    loadMoreReposBtn.hidden = repos.length < 30;
  }

  function showRepoInfo(data) {
    state.owner = data.owner;
    state.repo = data.name;
    state.repoUrl = data.html_url;
    state.selectedRefs.clear();

    document.getElementById("gh-repo-fullname").textContent = data.full_name;
    document.getElementById("gh-repo-visibility").textContent = data.private ? "Private" : "Public";
    document.getElementById("gh-repo-visibility").className = "badge badge-" + (data.private ? "private" : "public");
    document.getElementById("gh-repo-desc").textContent = data.description || "No description.";
    document.getElementById("gh-repo-stars").textContent = data.stargazers_count || 0;
    document.getElementById("gh-repo-branch").textContent = data.default_branch || "main";

    repoInfo.hidden = false;
    stepVersions.hidden = false;
    stepDetails.hidden = false;

    projectNameInput.value = data.name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
    state.autoSlug = true;
    projectSlugInput.value = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    loadTags(true);
    loadCommits(true);
    updateSelectionCount();
  }

  document.querySelectorAll(".gh-vtab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".gh-vtab").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      var target = btn.getAttribute("data-vtab");
      document.getElementById("gh-tags-panel").hidden = target !== "tags";
      document.getElementById("gh-commits-panel").hidden = target !== "commits";
    });
  });

  async function loadTags(reset) {
    if (reset) {
      state.tagPage = 1;
      document.querySelector("#gh-tags-table tbody").innerHTML = "";
    }
    try {
      var tags = await api("/admin/github/repos/" + encodeURIComponent(state.owner) + "/" + encodeURIComponent(state.repo) + "/tags?page=" + state.tagPage);
      renderTags(tags);
    } catch (err) {
      showToast("Failed to load tags: " + err.message, "error");
    }
  }

  function renderTags(tags) {
    var tbody = document.querySelector("#gh-tags-table tbody");
    var emptyEl = document.getElementById("gh-tags-empty");

    if (tags.length === 0 && state.tagPage === 1) {
      emptyEl.hidden = false;
      document.getElementById("gh-load-more-tags").hidden = true;
      return;
    }
    emptyEl.hidden = true;

    tags.forEach(function (tag) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td class="gh-check-col"><input type="checkbox" data-type="tag" data-sha="' + escapeHtml(tag.sha) + '" data-label="' + escapeHtml(tag.name) + '"></td>' + "<td>" + escapeHtml(tag.name) + "</td>" + "<td><code>" + escapeHtml(tag.sha.slice(0, 7)) + "</code></td>";
      tr.querySelector("input").addEventListener("change", onRefCheckChange);
      tbody.appendChild(tr);
    });

    document.getElementById("gh-load-more-tags").hidden = tags.length < 30;
  }

  document.getElementById("gh-load-more-tags").addEventListener("click", function () {
    state.tagPage++;
    loadTags(false);
  });

  document.getElementById("gh-select-all-tags").addEventListener("change", function () {
    var checked = this.checked;
    document.querySelectorAll('#gh-tags-table tbody input[type="checkbox"]').forEach(function (cb) {
      cb.checked = checked;
      toggleRef(cb);
    });
    updateSelectionCount();
  });

  async function loadCommits(reset) {
    if (reset) {
      state.commitPage = 1;
      document.querySelector("#gh-commits-table tbody").innerHTML = "";
    }
    try {
      var commits = await api("/admin/github/repos/" + encodeURIComponent(state.owner) + "/" + encodeURIComponent(state.repo) + "/commits?page=" + state.commitPage);
      renderCommits(commits);
    } catch (err) {
      showToast("Failed to load commits: " + err.message, "error");
    }
  }

  function renderCommits(commits) {
    var tbody = document.querySelector("#gh-commits-table tbody");
    commits.forEach(function (c) {
      var tr = document.createElement("tr");
      var dateStr = c.date ? new Date(c.date).toLocaleDateString() : "";
      tr.innerHTML = '<td class="gh-check-col"><input type="checkbox" data-type="commit" data-sha="' + escapeHtml(c.sha) + '" data-label="' + escapeHtml(c.shortSha + " - " + c.message.slice(0, 50)) + '"></td>' + "<td>" + escapeHtml(c.message.slice(0, 80)) + "</td>" + "<td><code>" + escapeHtml(c.shortSha) + "</code></td>" + "<td>" + escapeHtml(dateStr) + "</td>";
      tr.querySelector("input").addEventListener("change", onRefCheckChange);
      tbody.appendChild(tr);
    });

    document.getElementById("gh-load-more-commits").hidden = commits.length < 30;
  }

  document.getElementById("gh-load-more-commits").addEventListener("click", function () {
    state.commitPage++;
    loadCommits(false);
  });

  document.getElementById("gh-select-all-commits").addEventListener("change", function () {
    var checked = this.checked;
    document.querySelectorAll('#gh-commits-table tbody input[type="checkbox"]').forEach(function (cb) {
      cb.checked = checked;
      toggleRef(cb);
    });
    updateSelectionCount();
  });

  function onRefCheckChange() {
    toggleRef(this);
    updateSelectionCount();
  }

  function toggleRef(checkbox) {
    var sha = checkbox.getAttribute("data-sha");
    var label = checkbox.getAttribute("data-label");
    if (checkbox.checked) {
      state.selectedRefs.set(sha, { sha: sha, label: label });
    } else {
      state.selectedRefs.delete(sha);
    }
  }

  function updateSelectionCount() {
    var count = state.selectedRefs.size;
    importCountSpan.textContent = count;
    importBtn.disabled = count === 0;
  }

  projectNameInput.addEventListener("input", function () {
    if (state.autoSlug) {
      projectSlugInput.value = projectNameInput.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
  });
  projectSlugInput.addEventListener("input", function () {
    state.autoSlug = false;
  });

  importBtn.addEventListener("click", async function () {
    var name = projectNameInput.value.trim();
    var slug = projectSlugInput.value.trim();
    if (!name || !slug) {
      showToast("Project name and slug are required.", "error");
      return;
    }
    if (state.selectedRefs.size === 0) {
      showToast("Select at least one version to import.", "error");
      return;
    }

    var refs = Array.from(state.selectedRefs.values());
    var visibility = document.getElementById("gh-visibility").value;

    importBtn.disabled = true;
    progressWrap.hidden = false;
    progressFill.style.width = "10%";
    progressText.textContent = "Creating project and importing " + refs.length + " version(s)...";

    try {
      var result = await api("/admin/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: state.repoUrl,
          projectName: name,
          projectSlug: slug,
          visibility: visibility,
          refs: refs,
          _csrf: ghCsrfToken,
        }),
      });

      progressFill.style.width = "100%";

      var successCount = result.results.filter(function (r) {
        return r.success;
      }).length;
      var totalPages = result.results.reduce(function (sum, r) {
        return sum + r.pageCount;
      }, 0);
      progressText.textContent = "Done! Imported " + successCount + " version(s) with " + totalPages + " page(s).";

      var failedResults = result.results.filter(function (r) {
        return !r.success;
      });
      if (failedResults.length > 0) {
        progressText.textContent += " (" + failedResults.length + " failed)";
      }

      setTimeout(function () {
        window.location.href = "/admin/projects/" + result.projectId + "?success=Project imported from GitHub.";
      }, 1500);
    } catch (err) {
      progressFill.style.width = "0%";
      progressText.textContent = "Import failed: " + err.message;
      importBtn.disabled = false;
    }
  });
})();
