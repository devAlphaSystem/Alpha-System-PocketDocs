import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
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

export async function listVersions(projectId) {
  return pbList(COLLECTIONS.VERSIONS, {
    filter: `project = "${projectId}"`,
    sort: "-order,-created",
    perPage: 200,
  });
}

export async function getVersion(versionId) {
  const version = await pbGetOne(COLLECTIONS.VERSIONS, versionId, { expand: "project" });
  if (!version) {
    throw new NotFoundError("Version");
  }
  return version;
}

export async function getVersionBySlug(projectId, slug) {
  return pbGetFirstByFilter(COLLECTIONS.VERSIONS, `project = "${projectId}" && slug = "${slug}"`);
}

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
    await cloneVersionContent(data.clone_from, result.data.id, requestId);
  }

  logger.info("Version created", { requestId, versionId: result.data.id, projectId });
  return result.data;
}

async function cloneVersionContent(sourceVersionId, targetVersionId, requestId) {
  const sourcePages = await pbList(COLLECTIONS.PAGES, {
    filter: `version = "${sourceVersionId}"`,
    sort: "order",
    perPage: 500,
  });

  const idMap = new Map();

  const rootPages = (sourcePages.items || []).filter((p) => !p.parent);
  for (const page of rootPages) {
    const cloned = await pbCreate(COLLECTIONS.PAGES, {
      version: targetVersionId,
      title: page.title,
      slug: page.slug,
      content: page.content,
      icon: page.icon || "",
      order: page.order,
      parent: "",
    });
    if (cloned.ok) {
      idMap.set(page.id, cloned.data.id);
    }
  }

  const childPages = (sourcePages.items || []).filter((p) => p.parent);
  for (const page of childPages) {
    const newParent = idMap.get(page.parent) || "";
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

  const sourceChangelog = await pbGetFirstByFilter(COLLECTIONS.CHANGELOGS, `version = "${sourceVersionId}"`);
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

export async function updateVersion(versionId, data, requestId) {
  if (data.label) {
    const version = await getVersion(versionId);
    const slug = generateSlug(data.label);
    const existing = await getVersionBySlug(version.project, slug);
    if (existing && existing.id !== versionId) {
      throw new ConflictError("A version with this label already exists.");
    }
    data.slug = slug;
  }

  const result = await pbUpdate(COLLECTIONS.VERSIONS, versionId, data);
  if (!result.ok) {
    throw new ValidationError("Failed to update version.");
  }

  logger.info("Version updated", { requestId, versionId });
  return result.data;
}

export async function deleteVersion(versionId, requestId) {
  const result = await pbDelete(COLLECTIONS.VERSIONS, versionId);
  if (!result.ok) {
    throw new NotFoundError("Version");
  }

  logger.info("Version deleted", { requestId, versionId });
}
