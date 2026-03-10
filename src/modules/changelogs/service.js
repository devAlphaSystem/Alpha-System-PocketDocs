import { pbGetFirstByFilter, pbCreate, pbUpdate, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

/**
 * Retrieves the changelog record associated with a version.
 *
 * @param {string} versionId - The version ID to look up.
 * @returns {Promise<Object|null>} The changelog record, or `null` if none exists.
 */
export async function getChangelog(versionId) {
  return pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${pbFilterValue(versionId)}"`);
}

/**
 * Creates or updates the changelog for a given version.
 *
 * @param {string} versionId - The version ID to associate the changelog with.
 * @param {Object} data - Changelog data.
 * @param {string} data.content - The Markdown changelog content.
 * @param {string} [data.published_at] - Optional publication timestamp.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The created or updated changelog record.
 * @throws {ValidationError} If the create or update operation fails.
 */
export async function upsertChangelog(versionId, data, requestId) {
  const existing = await getChangelog(versionId);

  if (existing) {
    const result = await pbUpdate(COLLECTIONS.CHANGELOGS, existing.id, {
      content: data.content,
      published_at: data.published_at || "",
    });
    if (!result.ok) {
      throw new ValidationError("Failed to update changelog.");
    }
    logger.info("Changelog updated", { requestId, changelogId: existing.id, versionId });
    return result.data;
  }

  const result = await pbCreate(COLLECTIONS.CHANGELOGS, {
    version: versionId,
    content: data.content,
    published_at: data.published_at || "",
  });

  if (!result.ok) {
    throw new ValidationError("Failed to create changelog.");
  }

  logger.info("Changelog created", { requestId, changelogId: result.data.id, versionId });
  return result.data;
}
