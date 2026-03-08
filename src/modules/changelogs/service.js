import { pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { NotFoundError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

export async function getChangelog(versionId) {
  return pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${versionId}"`);
}

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

export async function deleteChangelog(versionId, requestId) {
  const existing = await getChangelog(versionId);
  if (!existing) {
    throw new NotFoundError("Changelog");
  }

  const result = await pbDelete(COLLECTIONS.CHANGELOGS, existing.id);
  if (!result.ok) {
    throw new NotFoundError("Changelog");
  }

  logger.info("Changelog deleted", { requestId, versionId });
}
