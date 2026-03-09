import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
import { COLLECTIONS, PAGINATION } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

export async function listProjects(userId, userRole, page = PAGINATION.DEFAULT_PAGE) {
  const perPage = PAGINATION.DEFAULT_PER_PAGE;
  return pbList(COLLECTIONS.PROJECTS, {
    page,
    perPage,
    sort: "-created",
    expand: "owner",
  });
}

export async function getProject(projectId) {
  const project = await pbGetOne(COLLECTIONS.PROJECTS, projectId, { expand: "owner" });
  if (!project) {
    throw new NotFoundError("Project");
  }
  return project;
}

export async function getProjectBySlug(slug) {
  return pbGetFirstByFilter(COLLECTIONS.PROJECTS, `slug = "${slug}"`, { expand: "owner" });
}

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
