import { pbList, pbGetFirstByFilter, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, VISIBILITY } from "../../config/constants.js";
import { NotFoundError } from "../../errors/taxonomy.js";

/**
 * Retrieves all publicly visible projects sorted by name.
 *
 * @returns {Promise<Object>} Paginated result containing public project items.
 */
export async function listPublicProjects() {
  return pbList(COLLECTIONS.PROJECTS, {
    filter: `visibility = "${VISIBILITY.PUBLIC}"`,
    sort: "name",
    perPage: 100,
  });
}

/**
 * Retrieves a public project by its slug.
 *
 * @param {string} projectSlug - The project slug.
 * @returns {Promise<Object>} The public project record.
 * @throws {NotFoundError} If no public project matches the slug.
 */
export async function getPublicProject(projectSlug) {
  const project = await pbGetFirstByFilter(COLLECTIONS.PROJECTS, `slug = "${pbFilterValue(projectSlug)}" && visibility = "${VISIBILITY.PUBLIC}"`);
  if (!project) {
    throw new NotFoundError("Project");
  }
  return project;
}

/**
 * Retrieves all public versions for a project, sorted by descending order.
 *
 * @param {string} projectId - The project record ID.
 * @returns {Promise<Object>} Paginated result containing public version items.
 */
export async function getPublicVersions(projectId) {
  return pbList(COLLECTIONS.VERSIONS, {
    filter: `project = "${pbFilterValue(projectId)}" && is_public = true`,
    sort: "-order,-created",
    perPage: 100,
  });
}

/**
 * Retrieves the default (first) public version for a project.
 *
 * @param {string} projectId - The project record ID.
 * @returns {Promise<Object|null>} The default version record, or `null` if none exist.
 */
export async function getDefaultVersion(projectId) {
  const versions = await getPublicVersions(projectId);
  if (!versions.items || versions.items.length === 0) {
    return null;
  }
  return versions.items[0];
}

/**
 * Retrieves a specific public version by project ID and version slug.
 *
 * @param {string} projectId - The project record ID.
 * @param {string} versionSlug - The version slug.
 * @returns {Promise<Object|null>} The version record, or `null` if not found.
 */
export async function getPublicVersion(projectId, versionSlug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project = "${pbFilterValue(projectId)}" && slug = "${pbFilterValue(versionSlug)}" && is_public = true`);
}

/**
 * Retrieves a public version by project slug and version slug, expanding the project relation.
 *
 * @param {string} projectSlug - The project slug.
 * @param {string} versionSlug - The version slug.
 * @returns {Promise<Object|null>} The version record with expanded project, or `null` if not found.
 */
export async function getPublicVersionByProjectSlug(projectSlug, versionSlug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project.slug = "${pbFilterValue(projectSlug)}" && project.visibility = "public" && slug = "${pbFilterValue(versionSlug)}" && is_public = true`, { expand: "project" });
}

/**
 * Retrieves all pages for a public version, sorted by order and title.
 *
 * @param {string} versionId - The version record ID.
 * @returns {Promise<Object>} Paginated result containing page items.
 */
export async function getPublicPages(versionId) {
  return pbList(COLLECTIONS.PAGES, {
    filter: `version = "${pbFilterValue(versionId)}"`,
    sort: "order,title",
    perPage: 500,
  });
}

/**
 * Retrieves a single public page by version ID and page slug.
 *
 * @param {string} versionId - The version record ID.
 * @param {string} pageSlug - The page slug.
 * @returns {Promise<Object|null>} The page record, or `null` if not found.
 */
export async function getPublicPage(versionId, pageSlug) {
  return pbGetFirstByFilter(COLLECTIONS.PAGES, `version = "${pbFilterValue(versionId)}" && slug = "${pbFilterValue(pageSlug)}"`);
}

/**
 * Retrieves the public changelog for a specific version.
 *
 * @param {string} versionId - The version record ID.
 * @returns {Promise<Object|null>} The changelog record, or `null` if none exists.
 */
export async function getPublicChangelog(versionId) {
  return pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${pbFilterValue(versionId)}"`);
}

/**
 * Searches public pages by title or content within a project, optionally
 * scoped to a specific version.
 *
 * @param {string} projectId - The project record ID.
 * @param {string} query - The search query string (minimum 2 characters).
 * @param {string|null} [versionId=null] - Optional version ID to narrow the search.
 * @returns {Promise<Array<Object>>} Array of matching page records with expanded version data.
 */
export async function searchPages(projectId, query, versionId = null) {
  const safeQuery = query.replace(/['"\\]/g, "");
  if (!safeQuery || safeQuery.length < 2) {
    return [];
  }

  let filter = `version.project = "${pbFilterValue(projectId)}" && version.is_public = true`;
  if (versionId) {
    filter += ` && version = "${pbFilterValue(versionId)}"`;
  }
  filter += ` && (title ~ "${pbFilterValue(safeQuery)}" || content ~ "${pbFilterValue(safeQuery)}")`;

  const result = await pbList(COLLECTIONS.PAGES, {
    filter,
    perPage: 20,
    expand: "version",
    fields: "id,title,slug,version,expand.version.label,expand.version.slug",
  });

  return result.items || [];
}
