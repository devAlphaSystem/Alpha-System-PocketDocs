import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, PAGINATION } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

/**
 * Retrieves a paginated list of projects sorted by creation date.
 *
 * @param {string} userId - The current user's ID.
 * @param {string} userRole - The current user's role.
 * @param {number} [page=1] - The 1-based page number.
 * @returns {Promise<Object>} Paginated result containing project items.
 */
export async function listProjects(userId, userRole, page = PAGINATION.DEFAULT_PAGE) {
  const perPage = PAGINATION.DEFAULT_PER_PAGE;
  return pbList(COLLECTIONS.PROJECTS, {
    page,
    perPage,
    sort: "-created",
    expand: "owner",
  });
}

/**
 * Retrieves a single project by its ID with the owner relation expanded.
 *
 * @param {string} projectId - The project record ID.
 * @returns {Promise<Object>} The project record.
 * @throws {NotFoundError} If the project does not exist.
 */
export async function getProject(projectId) {
  const project = await pbGetOne(COLLECTIONS.PROJECTS, projectId, { expand: "owner" });
  if (!project) {
    throw new NotFoundError("Project");
  }
  return project;
}

/**
 * Retrieves a single project by its URL slug.
 *
 * @param {string} slug - The project slug.
 * @returns {Promise<Object|null>} The project record, or `null` if not found.
 */
export async function getProjectBySlug(slug) {
  return pbGetFirstByFilter(COLLECTIONS.PROJECTS, `slug = "${pbFilterValue(slug)}"`, { expand: "owner" });
}

/**
 * Creates a new project after validating slug uniqueness.
 *
 * @param {Object} data - Project creation data.
 * @param {string} data.name - The project name.
 * @param {string} data.slug - The URL slug.
 * @param {string} [data.description] - An optional project description.
 * @param {string} [data.visibility] - The visibility level (`public` or `private`).
 * @param {string} userId - The owner's user ID.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The created project record.
 * @throws {ConflictError} If a project with the same slug already exists.
 * @throws {ValidationError} If the creation fails.
 */
export async function createProject(data, userId, requestId) {
  const existing = await getProjectBySlug(data.slug);
  if (existing) {
    throw new ConflictError("A project with this slug already exists.");
  }

  const result = await pbCreate(COLLECTIONS.PROJECTS, {
    ...data,
    owner: userId,
  });

  if (!result.ok) {
    throw new ValidationError("Failed to create project.", formatPbErrors(result.data));
  }

  logger.info("Project created", { requestId, projectId: result.data.id, slug: data.slug });
  return result.data;
}

/**
 * Updates an existing project, validating slug uniqueness if the slug is changed.
 *
 * @param {string} projectId - The project record ID.
 * @param {Object} data - The fields to update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated project record.
 * @throws {ConflictError} If the new slug collides with another project.
 * @throws {ValidationError} If the update fails.
 */
export async function updateProject(projectId, data, requestId) {
  if (data.slug) {
    const existing = await getProjectBySlug(data.slug);
    if (existing && existing.id !== projectId) {
      throw new ConflictError("A project with this slug already exists.");
    }
  }

  const result = await pbUpdate(COLLECTIONS.PROJECTS, projectId, data);
  if (!result.ok) {
    throw new ValidationError("Failed to update project.", formatPbErrors(result.data));
  }

  logger.info("Project updated", { requestId, projectId });
  return result.data;
}

/**
 * Deletes a project by its ID.
 *
 * @param {string} projectId - The project record ID.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<void>}
 * @throws {NotFoundError} If the project does not exist.
 */
export async function deleteProject(projectId, requestId) {
  const result = await pbDelete(COLLECTIONS.PROJECTS, projectId);
  if (!result.ok) {
    throw new NotFoundError("Project");
  }

  logger.info("Project deleted", { requestId, projectId });
}

function formatPbErrors(data) {
  if (!data?.data) {
    return [];
  }
  return Object.entries(data.data).map(([field, err]) => ({
    field,
    code: (err.code || "INVALID").toUpperCase(),
    message: err.message || "Invalid value.",
  }));
}
