import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, PAGINATION } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

/**
 * Retrieves all pages belonging to a version, sorted by order and title.
 *
 * @param {string} versionId - The version ID to list pages for.
 * @returns {Promise<Object>} Paginated result containing page items.
 */
export async function listPages(versionId) {
  return pbList(COLLECTIONS.PAGES, {
    filter: `version = "${pbFilterValue(versionId)}"`,
    sort: "order,title",
    perPage: 500,
  });
}

/**
 * Retrieves a paginated list of pages for a version with optional search.
 *
 * @param {string} versionId - The version record ID.
 * @param {number} [page=1] - The 1-based page number.
 * @param {string} [search=""] - Optional search term to filter by title or slug.
 * @returns {Promise<Object>} Paginated result containing page items.
 */
export async function listPagesPaginated(versionId, page = PAGINATION.DEFAULT_PAGE, search = "") {
  let filter = `version = "${pbFilterValue(versionId)}"`;
  if (search) {
    filter += ` && (title ~ "${pbFilterValue(search)}" || slug ~ "${pbFilterValue(search)}")`;
  }
  return pbList(COLLECTIONS.PAGES, {
    filter,
    sort: "order,title",
    page,
    perPage: PAGINATION.DEFAULT_PER_PAGE,
  });
}

/**
 * Transforms a flat array of pages into a nested tree structure based on
 * parent-child relationships.
 *
 * @param {Array<Object>} pages - Flat array of page records.
 * @returns {Array<Object>} Array of root page nodes, each with a `children` array.
 */
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

/**
 * Retrieves a single page by its ID with the version relation expanded.
 *
 * @param {string} pageId - The page record ID.
 * @returns {Promise<Object>} The page record with expanded version.
 * @throws {NotFoundError} If the page does not exist.
 */
export async function getPage(pageId) {
  const page = await pbGetOne(COLLECTIONS.PAGES, pageId, { expand: "version" });
  if (!page) {
    throw new NotFoundError("Page");
  }
  return page;
}

/**
 * Retrieves a single page by its slug within a version.
 *
 * @param {string} versionId - The version ID to search within.
 * @param {string} slug - The page slug.
 * @returns {Promise<Object|null>} The matching page record, or `null` if not found.
 */
export async function getPageBySlug(versionId, slug) {
  return pbGetFirstByFilter(COLLECTIONS.PAGES, `version = "${pbFilterValue(versionId)}" && slug = "${pbFilterValue(slug)}"`);
}

/**
 * Creates a new page in the specified version after validating slug uniqueness.
 *
 * @param {string} versionId - The version ID to create the page in.
 * @param {Object} data - Page creation data.
 * @param {string} data.title - The page title.
 * @param {string} data.slug - The URL slug.
 * @param {string} [data.content] - The Markdown content.
 * @param {string} [data.parent] - The parent page ID.
 * @param {string} [data.icon] - The page icon identifier.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The created page record.
 * @throws {ConflictError} If a page with the same slug already exists.
 * @throws {ValidationError} If the creation fails.
 */
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

/**
 * Updates an existing page, validating slug uniqueness if the slug is changed.
 *
 * @param {string} pageId - The page record ID to update.
 * @param {Object} data - The fields to update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated page record.
 * @throws {ConflictError} If the new slug collides with another page.
 * @throws {ValidationError} If the update fails.
 */
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

/**
 * Deletes a page and re-parents its children to the deleted page's parent.
 *
 * @param {string} pageId - The page record ID to delete.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<void>}
 * @throws {NotFoundError} If the page does not exist.
 */
export async function deletePage(pageId, requestId) {
  const page = await getPage(pageId);

  const children = await pbList(COLLECTIONS.PAGES, {
    filter: `parent = "${pbFilterValue(pageId)}"`,
    perPage: 200,
  });
  await Promise.all((children.items || []).map((child) => pbUpdate(COLLECTIONS.PAGES, child.id, { parent: page.parent || "" })));

  const result = await pbDelete(COLLECTIONS.PAGES, pageId);
  if (!result.ok) {
    throw new NotFoundError("Page");
  }

  logger.info("Page deleted", { requestId, pageId });
}

/**
 * Batch-updates page ordering and parent assignments.
 *
 * @param {Array<{ id: string, order: number, parent: string }>} updates - The reorder instructions.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<void>}
 */
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
