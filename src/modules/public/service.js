import { pbList, pbGetFirstByFilter, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, VISIBILITY } from "../../config/constants.js";
import { NotFoundError } from "../../errors/taxonomy.js";

export async function listPublicProjects() {
  return pbList(COLLECTIONS.PROJECTS, {
    filter: `visibility = "${VISIBILITY.PUBLIC}"`,
    sort: "name",
    perPage: 100,
  });
}

export async function getPublicProject(projectSlug) {
  const project = await pbGetFirstByFilter(COLLECTIONS.PROJECTS, `slug = "${pbFilterValue(projectSlug)}" && visibility = "${VISIBILITY.PUBLIC}"`);
  if (!project) {
    throw new NotFoundError("Project");
  }
  return project;
}

export async function getPublicVersions(projectId) {
  return pbList(COLLECTIONS.VERSIONS, {
    filter: `project = "${pbFilterValue(projectId)}" && is_public = true`,
    sort: "-order,-created",
    perPage: 100,
  });
}

export async function getDefaultVersion(projectId) {
  const versions = await getPublicVersions(projectId);
  if (!versions.items || versions.items.length === 0) {
    return null;
  }
  return versions.items[0];
}

export async function getPublicVersion(projectId, versionSlug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project = "${pbFilterValue(projectId)}" && slug = "${pbFilterValue(versionSlug)}" && is_public = true`);
}

export async function getPublicVersionByProjectSlug(projectSlug, versionSlug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project.slug = "${pbFilterValue(projectSlug)}" && project.visibility = "public" && slug = "${pbFilterValue(versionSlug)}" && is_public = true`, { expand: "project" });
}

export async function getPublicPages(versionId) {
  return pbList(COLLECTIONS.PAGES, {
    filter: `version = "${pbFilterValue(versionId)}"`,
    sort: "order,title",
    perPage: 500,
  });
}

export async function getPublicPage(versionId, pageSlug) {
  return pbGetFirstByFilter(COLLECTIONS.PAGES, `version = "${pbFilterValue(versionId)}" && slug = "${pbFilterValue(pageSlug)}"`);
}

export async function getPublicChangelog(versionId) {
  return pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${pbFilterValue(versionId)}"`);
}

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
