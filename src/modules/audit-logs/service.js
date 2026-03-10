/**
 * @module audit-logs/service
 * @description Business logic for recording and querying audit log entries.
 */
import { pbCreate, pbList, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { logger } from "../../lib/logger.js";

/**
 * Audit log action constants grouped by category.
 */
export const AUDIT_ACTIONS = Object.freeze({
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_LOGIN_FAILED: "auth.login_failed",

  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",

  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_DELETED: "project.deleted",

  VERSION_CREATED: "version.created",
  VERSION_UPDATED: "version.updated",
  VERSION_DELETED: "version.deleted",

  PAGE_CREATED: "page.created",
  PAGE_UPDATED: "page.updated",
  PAGE_DELETED: "page.deleted",

  CHANGELOG_UPDATED: "changelog.updated",

  SETTINGS_UPDATED: "settings.updated",
  IP_RESTRICTION_UPDATED: "settings.ip_restriction_updated",

  GITHUB_IMPORT: "github.import",
});

/**
 * Derives the category from an action string (e.g. "user.created" → "user").
 *
 * @param {string} action
 * @returns {string}
 */
function categoryFromAction(action) {
  return action.split(".")[0];
}

/**
 * Records an audit log entry. This is fire-and-forget — failures are logged
 * but never thrown so that auditing never breaks primary operations.
 *
 * @param {Object} entry
 * @param {string} entry.action - One of the AUDIT_ACTIONS constants.
 * @param {string} [entry.userId] - The ID of the user who performed the action.
 * @param {string} [entry.userEmail] - The email of the user (denormalized for display).
 * @param {string} [entry.targetType] - The entity type affected (e.g. "project").
 * @param {string} [entry.targetId] - The entity ID affected.
 * @param {string} [entry.description] - Human-readable description of the action.
 * @param {string} [entry.ipAddress] - The originating IP address.
 */
export async function recordAuditLog(entry) {
  try {
    await pbCreate(COLLECTIONS.AUDIT_LOGS, {
      action: entry.action,
      category: categoryFromAction(entry.action),
      user: entry.userId || "",
      user_email: entry.userEmail || "",
      target_type: entry.targetType || "",
      target_id: entry.targetId || "",
      description: entry.description || "",
      ip_address: entry.ipAddress || "",
    });
  } catch (err) {
    logger.error("Failed to record audit log", {
      action: entry.action,
      error: err.message,
    });
  }
}

/**
 * Retrieves a paginated list of audit log entries with optional filters.
 *
 * @param {Object} [options]
 * @param {number} [options.page=1]
 * @param {number} [options.perPage=50]
 * @param {string} [options.category] - Filter by category.
 * @param {string} [options.search] - Search text across action and description.
 * @returns {Promise<Object>} Paginated result with audit log items.
 */
export async function listAuditLogs({ page = 1, perPage = 50, category, search } = {}) {
  const filters = [];

  if (category) {
    filters.push(`category = "${pbFilterValue(category)}"`);
  }

  if (search) {
    const escaped = pbFilterValue(search);
    filters.push(`(action ~ "${escaped}" || description ~ "${escaped}" || user_email ~ "${escaped}")`);
  }

  return await pbList(COLLECTIONS.AUDIT_LOGS, {
    page,
    perPage,
    sort: "-created",
    filter: filters.length > 0 ? filters.join(" && ") : undefined,
    expand: "user",
  });
}
