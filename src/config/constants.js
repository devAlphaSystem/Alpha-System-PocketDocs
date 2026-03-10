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
