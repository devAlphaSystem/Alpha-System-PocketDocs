/**
 * Defines the available user roles and their permission levels.
 *
 * @enum {string}
 */
export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
});

/**
 * Defines the visibility levels for projects.
 *
 * @enum {string}
 */
export const VISIBILITY = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private",
});

/**
 * Defines the project mode.
 *
 * @enum {string}
 */
export const PROJECT_MODE = Object.freeze({
  VERSIONED: "versioned",
  NON_VERSIONED: "non_versioned",
});

/**
 * Defines the fixed content sections stored in the pages collection.
 *
 * @enum {string}
 */
export const PAGE_SECTIONS = Object.freeze({
  DOCUMENTS: "documents",
  FAQ: "faq",
  TROUBLESHOOTING: "troubleshooting",
});

/**
 * Defines the record types that can participate in the documents sidebar order.
 * Existing records without a value are treated as pages for backwards compatibility.
 *
 * @enum {string}
 */
export const PAGE_ITEM_TYPES = Object.freeze({
  PAGE: "page",
  HEADER: "header",
  SEPARATOR: "separator",
});

/**
 * Maps page section values to their public labels.
 *
 * @enum {string}
 */
export const PAGE_SECTION_LABELS = Object.freeze({
  [PAGE_SECTIONS.DOCUMENTS]: "Documents",
  [PAGE_SECTIONS.FAQ]: "Frequently Asked Questions",
  [PAGE_SECTIONS.TROUBLESHOOTING]: "Troubleshooting",
});

/**
 * Maps page section values to their default Phosphor icon names.
 *
 * @enum {string}
 */
export const PAGE_SECTION_ICONS = Object.freeze({
  [PAGE_SECTIONS.DOCUMENTS]: "file-text",
  [PAGE_SECTIONS.FAQ]: "question",
  [PAGE_SECTIONS.TROUBLESHOOTING]: "wrench",
});

/**
 * Maps logical collection names to their PocketBase collection identifiers.
 *
 * @enum {string}
 */
export const COLLECTIONS = Object.freeze({
  USERS: "users",
  PROJECTS: "projects",
  VERSIONS: "versions",
  PAGES: "pages",
  CHANGELOGS: "changelogs",
  SITE_SETTINGS: "site_settings",
});

/**
 * Defines default and maximum pagination settings for list queries.
 *
 * @enum {number}
 */
export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 25,
});

/**
 * Maps logical cookie purposes to their HTTP cookie name strings.
 *
 * @enum {string}
 */
export const COOKIE_NAMES = Object.freeze({
  AUTH_TOKEN: "pd_auth",
  CSRF_TOKEN: "pd_csrf",
  DOWNLOAD_TOKEN: "pd_download",
});

/** @type {RegExp} Matches valid URL-safe slug strings (lowercase alphanumeric with hyphens). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** @type {number} Maximum allowed character length for slug fields. */
export const MAX_SLUG_LENGTH = 120;
/** @type {number} Maximum allowed character length for title fields. */
export const MAX_TITLE_LENGTH = 200;
/** @type {number} Maximum allowed character length for description fields. */
export const MAX_DESCRIPTION_LENGTH = 500;
/** @type {number} Maximum allowed character length for content fields. */
export const MAX_CONTENT_LENGTH = 500000;
/** @type {number} Maximum allowed character length for label fields. */
export const MAX_LABEL_LENGTH = 100;

/**
 * Defines the server-side total size limit for bulk Markdown page imports.
 *
 * These limits sit below the Express body parser cap so validation can return
 * a structured application error before oversized payloads reach storage.
 *
 * @enum {number}
 */
export const MARKDOWN_IMPORT = Object.freeze({
  MAX_TOTAL_CONTENT_LENGTH: 1500000,
});
