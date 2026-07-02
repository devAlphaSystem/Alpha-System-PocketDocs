/**
 * @module lib/view-helpers
 * @description Rendering helpers shared by EJS layouts and partials.
 */

export function normalizeViewAssetList(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function buildPaginationViewModel({ pagination, search = "", queryParams = {} } = {}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  const totalPages = Number(pagination.totalPages) || 0;
  const currentPage = Number(pagination.page) || 1;
  const params = [];

  for (const [key, value] of Object.entries(queryParams || {})) {
    appendQueryParam(params, key, value);
  }

  appendQueryParam(params, "search", search);

  return {
    totalPages,
    currentPage,
    hasPrevious: currentPage > 1,
    previousPage: currentPage - 1,
    hasNext: currentPage < totalPages,
    nextPage: currentPage + 1,
    pages: buildPaginationWindow(totalPages, currentPage),
    querySuffix: params.length > 0 ? `&${params.join("&")}` : "",
  };
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

export function formatLongDate(value) {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatLongDateTime(value) {
  return new Date(value).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function appendQueryParam(params, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
}

function buildPaginationWindow(totalPages, currentPage) {
  const delta = 1;
  const pages = [];

  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || (page >= currentPage - delta && page <= currentPage + delta)) {
      pages.push(page);
    } else if (pages.length > 0 && pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return pages;
}
