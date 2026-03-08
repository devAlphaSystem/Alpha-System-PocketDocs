import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
import { COLLECTIONS } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

export async function listPages(versionId) {
  return pbList(COLLECTIONS.PAGES, {
    filter: `version = "${versionId}"`,
    sort: "order,title",
    perPage: 500,
  });
}

export function buildPageTree(pages) {
  const map = new Map();
  const roots = [];

  for (const page of pages) {
    map.set(page.id, { ...page, children: [] });
  }

  for (const page of pages) {
    const node = map.get(page.id);
    if (page.parent && map.has(page.parent)) {
      map.get(page.parent).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getPage(pageId) {
  const page = await pbGetOne(COLLECTIONS.PAGES, pageId, { expand: "version" });
  if (!page) {
    throw new NotFoundError("Page");
  }
  return page;
}

export async function getPageBySlug(versionId, slug) {
  return pbGetFirstByFilter(COLLECTIONS.PAGES, `version = "${versionId}" && slug = "${slug}"`);
}

export async function createPage(versionId, data, requestId) {
  const [existing, allPages] = await Promise.all([getPageBySlug(versionId, data.slug), listPages(versionId)]);
  if (existing) {
    throw new ConflictError("A page with this slug already exists in this version.");
  }

  const maxOrder = allPages.items?.reduce((max, p) => Math.max(max, p.order || 0), 0) || 0;

  const result = await pbCreate(COLLECTIONS.PAGES, {
    version: versionId,
    title: data.title,
    slug: data.slug,
    content: data.content || "",
    parent: data.parent || "",
    icon: data.icon || "",
    order: maxOrder + 1,
  });

  if (!result.ok) {
    throw new ValidationError("Failed to create page.");
  }

  logger.info("Page created", { requestId, pageId: result.data.id, versionId });
  return result.data;
}

export async function updatePage(pageId, data, requestId) {
  if (data.slug) {
    const page = await getPage(pageId);
    const versionId = page.version;
    const existing = await getPageBySlug(versionId, data.slug);
    if (existing && existing.id !== pageId) {
      throw new ConflictError("A page with this slug already exists.");
    }
  }

  const result = await pbUpdate(COLLECTIONS.PAGES, pageId, data);
  if (!result.ok) {
    throw new ValidationError("Failed to update page.");
  }

  logger.info("Page updated", { requestId, pageId });
  return result.data;
}

export async function deletePage(pageId, requestId) {
  const page = await getPage(pageId);

  const children = await pbList(COLLECTIONS.PAGES, {
    filter: `parent = "${pageId}"`,
    perPage: 200,
  });
  await Promise.all((children.items || []).map((child) => pbUpdate(COLLECTIONS.PAGES, child.id, { parent: page.parent || "" })));

  const result = await pbDelete(COLLECTIONS.PAGES, pageId);
  if (!result.ok) {
    throw new NotFoundError("Page");
  }

  logger.info("Page deleted", { requestId, pageId });
}

export async function reorderPages(updates, requestId) {
  const results = await Promise.all(updates.map((u) => pbUpdate(COLLECTIONS.PAGES, u.id, { order: u.order, parent: u.parent || "" })));

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    logger.warn("Some page reorder operations failed", {
      requestId,
      failedCount: failed.length,
    });
  }

  logger.info("Pages reordered", { requestId, count: updates.length });
}
