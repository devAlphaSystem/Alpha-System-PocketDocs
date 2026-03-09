import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

function generateSlug(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Retrieves all versions belonging to a project, sorted by descending order.
 *
 * @param {string} projectId - The project record ID.
 * @returns {Promise<Object>} Paginated result containing version items.
 */
export async function listVersions(projectId) {
  return pbList(COLLECTIONS.VERSIONS, {
    filter: `project = "${pbFilterValue(projectId)}"`,
    sort: "-order,-created",
    perPage: 200,
  });
}

/**
 * Retrieves a single version by its ID with the project relation expanded.
 *
 * @param {string} versionId - The version record ID.
 * @returns {Promise<Object>} The version record with expanded project.
 * @throws {NotFoundError} If the version does not exist.
 */
export async function getVersion(versionId) {
  const version = await pbGetOne(COLLECTIONS.VERSIONS, versionId, { expand: "project" });
  if (!version) {
    throw new NotFoundError("Version");
  }
  return version;
}

/**
 * Retrieves a version by its slug within a project.
 *
 * @param {string} projectId - The project record ID.
 * @param {string} slug - The version slug.
 * @returns {Promise<Object|null>} The version record, or `null` if not found.
 */
export async function getVersionBySlug(projectId, slug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project = "${pbFilterValue(projectId)}" && slug = "${pbFilterValue(slug)}"`);
}

/**
 * Creates a new version under a project, optionally cloning content from
 * an existing version.
 *
 * @param {string} projectId - The project record ID.
 * @param {Object} data - Version creation data.
 * @param {string} data.label - The version label.
 * @param {boolean} [data.is_public] - Whether the version is publicly visible.
 * @param {string} [data.clone_from] - An existing version ID to clone pages from.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The created version record.
 * @throws {ConflictError} If a version with the same label already exists.
 * @throws {ValidationError} If the creation fails.
 */
export async function createVersion(projectId, data, requestId) {
  const slug = generateSlug(data.label);

  const [existing, allVersions] = await Promise.all([getVersionBySlug(projectId, slug), listVersions(projectId)]);
  if (existing) {
    throw new ConflictError("A version with this label already exists in this project.");
  }

  const maxOrder = allVersions.items?.reduce((max, v) => Math.max(max, v.order || 0), 0) || 0;

  const result = await pbCreate(COLLECTIONS.VERSIONS, {
    project: projectId,
    label: data.label,
    slug,
    is_public: data.is_public || false,
    order: maxOrder + 1,
  });

  if (!result.ok) {
    throw new ValidationError("Failed to create version.");
  }

  if (data.clone_from) {
    const sourceVersion = await pbGetOne(COLLECTIONS.VERSIONS, data.clone_from);
    if (sourceVersion && sourceVersion.project === projectId) {
      await cloneVersionContent(data.clone_from, result.data.id, requestId);
    }
  }

  logger.info("Version created", { requestId, versionId: result.data.id, projectId });
  return result.data;
}

async function cloneVersionContent(sourceVersionId, targetVersionId, requestId) {
  const sourcePages = await pbList(COLLECTIONS.PAGES, {
    filter: `version = "${pbFilterValue(sourceVersionId)}"`,
    sort: "order",
    perPage: 500,
  });

  const idMap = new Map();
  const allPages = sourcePages.items || [];

  const sorted = [];
  const remaining = [...allPages];
  const processed = new Set();

  for (let i = remaining.length - 1; i >= 0; i--) {
    if (!remaining[i].parent) {
      sorted.push(remaining[i]);
      processed.add(remaining[i].id);
      remaining.splice(i, 1);
    }
  }

  let safety = remaining.length + 1;
  while (remaining.length > 0 && safety-- > 0) {
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (processed.has(remaining[i].parent)) {
        sorted.push(remaining[i]);
        processed.add(remaining[i].id);
        remaining.splice(i, 1);
      }
    }
  }
  sorted.push(...remaining);

  for (const page of sorted) {
    const newParent = page.parent ? idMap.get(page.parent) || "" : "";
    const cloned = await pbCreate(COLLECTIONS.PAGES, {
      version: targetVersionId,
      title: page.title,
      slug: page.slug,
      content: page.content,
      icon: page.icon || "",
      order: page.order,
      parent: newParent,
    });
    if (cloned.ok) {
      idMap.set(page.id, cloned.data.id);
    }
  }

  const sourceChangelog = await pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${pbFilterValue(sourceVersionId)}"`);
  if (sourceChangelog) {
    await pbCreate(COLLECTIONS.CHANGELOGS, {
      version: targetVersionId,
      content: "",
    });
  }

  logger.info("Version content cloned", {
    requestId,
    sourceVersionId,
    targetVersionId,
    pagesCloned: idMap.size,
  });
}

/**
 * Updates an existing version, regenerating the slug if the label is changed.
 *
 * @param {string} versionId - The version record ID.
 * @param {Object} data - The fields to update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated version record.
 * @throws {ConflictError} If the new label generates a slug that collides with another version.
 * @throws {ValidationError} If the update fails.
 */
export async function updateVersion(versionId, data, requestId) {
  const updateData = { ...data };

  if (updateData.label) {
    const version = await getVersion(versionId);
    const slug = generateSlug(updateData.label);
    const existing = await getVersionBySlug(version.project, slug);
    if (existing && existing.id !== versionId) {
      throw new ConflictError("A version with this label already exists.");
    }
    updateData.slug = slug;
  }

  const result = await pbUpdate(COLLECTIONS.VERSIONS, versionId, updateData);
  if (!result.ok) {
    throw new ValidationError("Failed to update version.");
  }

  logger.info("Version updated", { requestId, versionId });
  return result.data;
}

/**
 * Deletes a version by its ID.
 *
 * @param {string} versionId - The version record ID.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<void>}
 * @throws {NotFoundError} If the version does not exist.
 */
export async function deleteVersion(versionId, requestId) {
  const result = await pbDelete(COLLECTIONS.VERSIONS, versionId);
  if (!result.ok) {
    throw new NotFoundError("Version");
  }

  logger.info("Version deleted", { requestId, versionId });
}
