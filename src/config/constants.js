export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
});

export const VISIBILITY = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private",
});

export const COLLECTIONS = Object.freeze({
  USERS: "users",
  SUPERUSERS: "_superusers",
  PROJECTS: "projects",
  VERSIONS: "versions",
  PAGES: "pages",
  CHANGELOGS: "changelogs",
});

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 30,
  MAX_PER_PAGE: 100,
});

export const COOKIE_NAMES = Object.freeze({
  AUTH_TOKEN: "pd_auth",
  CSRF_TOKEN: "pd_csrf",
  THEME: "pd_theme",
});

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 120;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_CONTENT_LENGTH = 500000;
export const MAX_LABEL_LENGTH = 100;
