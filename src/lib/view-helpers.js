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

export function buildLoadMoreViewModel({ pagination, search = "", queryParams = {} } = {}) {
  if (!pagination) {
    return null;
  }

  const totalPages = Number(pagination.totalPages) || 0;
  const currentPage = Number(pagination.page) || 1;
  if (currentPage >= totalPages) {
    return null;
  }

  const params = [];

  for (const [key, value] of Object.entries(queryParams || {})) {
    appendQueryParam(params, key, value);
  }

  appendQueryParam(params, "search", search);

  return {
    nextPage: currentPage + 1,
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
