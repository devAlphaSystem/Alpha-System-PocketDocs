import { pbList, pbGetFirstByFilter, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, VISIBILITY } from "../../config/constants.js";
import { NotFoundError } from "../../errors/taxonomy.js";

/**
 * Retrieves the single internal version for a simple-mode project.
 *
 * @param {string} projectId - The project record ID.
 * @param {boolean} [isAdmin=false] - Whether the current user is an admin previewing content.
 * @returns {Promise<Object|null>} The version record, or `null` if not found.
 */
export async function getSimpleProjectVersion(projectId, isAdmin = false) {
  const filter = isAdmin ? `project = "${pbFilterValue(projectId)}"` : `project = "${pbFilterValue(projectId)}" && is_public = true`;
  const result = await pbList(COLLECTIONS.VERSIONS, { filter, sort: "order", perPage: 1 });
  return result.items?.[0] || null;
}

/**
 * Retrieves a single public page directly by project slug and page slug for simple-mode projects.
 *
 * @param {string} projectId - The project record ID.
 * @param {string} pageSlug - The page slug.
 * @param {string} versionId - The internal default version ID.
 * @returns {Promise<Object|null>} The page record, or `null` if not found.
 */
export async function getSimpleProjectPage(projectId, pageSlug, versionId) {
  return pbGetFirstByFilter(COLLECTIONS.PAGES, `version = "${pbFilterValue(versionId)}" && slug = "${pbFilterValue(pageSlug)}"`);
}

/**
 * Retrieves all publicly visible projects sorted by name.
 * When isAdmin is true, returns all projects regardless of visibility.
 *
 * @param {boolean} [isAdmin=false] - Whether the current user is an admin previewing content.
 * @returns {Promise<Object>} Paginated result containing project items.
 */
export async function listPublicProjects(isAdmin = false) {
  return pbList(COLLECTIONS.PROJECTS, {
    filter: isAdmin ? "" : `visibility = "${VISIBILITY.PUBLIC}"`,
    sort: "name",
    perPage: 100,
  });
}

/**
 * Retrieves a public project by its slug.
 * When isAdmin is true, returns the project regardless of visibility.
 *
 * @param {string} projectSlug - The project slug.
 * @param {boolean} [isAdmin=false] - Whether the current user is an admin previewing content.
 * @returns {Promise<Object>} The project record.
 * @throws {NotFoundError} If no project matches the slug.
 */
export async function getPublicProject(projectSlug, isAdmin = false) {
  const filter = isAdmin ? `slug = "${pbFilterValue(projectSlug)}"` : `slug = "${pbFilterValue(projectSlug)}" && visibility = "${VISIBILITY.PUBLIC}"`;
  const project = await pbGetFirstByFilter(COLLECTIONS.PROJECTS, filter);
  if (!project) {
    throw new NotFoundError("Project");
  }
  return project;
}

/**
 * Retrieves all public versions for a project, sorted by descending order.
 * When isAdmin is true, returns all versions regardless of public status.
 *
 * @param {string} projectId - The project record ID.
 * @param {boolean} [isAdmin=false] - Whether the current user is an admin previewing content.
 * @returns {Promise<Object>} Paginated result containing version items.
 */
export async function getPublicVersions(projectId, isAdmin = false) {
  const filter = isAdmin ? `project = "${pbFilterValue(projectId)}"` : `project = "${pbFilterValue(projectId)}" && is_public = true`;
  return pbList(COLLECTIONS.VERSIONS, {
    filter,
    sort: "-order,-created",
    perPage: 100,
  });
}

/**
 * Retrieves a public version by project slug and version slug, expanding the project relation.
 * When isAdmin is true, returns the version regardless of visibility.
 *
 * @param {string} projectSlug - The project slug.
 * @param {string} versionSlug - The version slug.
 * @param {boolean} [isAdmin=false] - Whether the current user is an admin previewing content.
 * @returns {Promise<Object|null>} The version record with expanded project, or `null` if not found.
 */
export async function getPublicVersionByProjectSlug(projectSlug, versionSlug, isAdmin = false) {
  const filter = isAdmin ? `project.slug = "${pbFilterValue(projectSlug)}" && slug = "${pbFilterValue(versionSlug)}"` : `project.slug = "${pbFilterValue(projectSlug)}" && project.visibility = "public" && slug = "${pbFilterValue(versionSlug)}" && is_public = true`;
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, filter, { expand: "project" });
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
export async function searchPages(projectId, query, versionId = null, isAdmin = false) {
  const safeQuery = query.replace(/['"\\]/g, "");
  if (!safeQuery || safeQuery.length < 2) {
    return [];
  }

  let filter = isAdmin ? `version.project = "${pbFilterValue(projectId)}"` : `version.project = "${pbFilterValue(projectId)}" && version.is_public = true`;
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
