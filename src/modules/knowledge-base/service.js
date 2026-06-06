import { pbList, pbGetOne, pbGetFirstByFilter, pbCreate, pbUpdate, pbDelete, pbFilterValue } from "../../lib/pocketbase.js";
import { COLLECTIONS, PAGINATION, KNOWLEDGE_BASE_SECTIONS, KNOWLEDGE_BASE_SECTION_LABELS } from "../../config/constants.js";
import { NotFoundError, ConflictError, ValidationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";
import { buildPageTree } from "../pages/service.js";
import { buildMarkdownImportHierarchy, formatMarkdownImportPbErrors, formatMarkdownImportSlugList, isPocketBaseUniqueSlugError, normalizeMarkdownImportFiles } from "../pages/import-utils.js";

export const KNOWLEDGE_BASE_SECTION_OPTIONS = Object.freeze([
  { value: KNOWLEDGE_BASE_SECTIONS.FAQ, label: KNOWLEDGE_BASE_SECTION_LABELS[KNOWLEDGE_BASE_SECTIONS.FAQ], icon: "question" },
  { value: KNOWLEDGE_BASE_SECTIONS.TROUBLESHOOTING, label: KNOWLEDGE_BASE_SECTION_LABELS[KNOWLEDGE_BASE_SECTIONS.TROUBLESHOOTING], icon: "wrench" },
]);

/**
 * Checks whether a value is a valid Knowledge Base section.
 *
 * @param {string} section - Candidate section value.
 * @returns {boolean} True when the section is supported.
 */
export function isKnowledgeBaseSection(section) {
  return Object.values(KNOWLEDGE_BASE_SECTIONS).includes(section);
}

/**
 * Returns the display label for a Knowledge Base section.
 *
 * @param {string} section - Knowledge Base section value.
 * @returns {string} Human-readable label.
 */
export function getKnowledgeBaseSectionLabel(section) {
  return KNOWLEDGE_BASE_SECTION_LABELS[section] || "Knowledge Base";
}

/**
 * Asserts that a Knowledge Base section value is valid.
 *
 * @param {string} section - Candidate section value.
 * @returns {string} The valid section value.
 * @throws {NotFoundError} If the section is unknown.
 */
export function assertKnowledgeBaseSection(section) {
  if (!isKnowledgeBaseSection(section)) {
    throw new NotFoundError("Knowledge Base section");
  }
  return section;
}

/**
 * Builds a nested Knowledge Base page tree from a flat page list.
 *
 * @param {Array<Object>} pages - Flat page records.
 * @returns {Array<Object>} Root nodes with nested children.
 */
export function buildKnowledgeBaseTree(pages) {
  return buildPageTree(pages);
}

function knowledgeBaseFilter(versionId, section = "") {
  let filter = `version = "${pbFilterValue(versionId)}"`;
  if (section) {
    filter += ` && section = "${pbFilterValue(assertKnowledgeBaseSection(section))}"`;
  }
  return filter;
}

/**
 * Lists Knowledge Base pages for a version, optionally scoped to one section.
 *
 * @param {string} versionId - Version record ID.
 * @param {string} [section=""] - Optional Knowledge Base section.
 * @returns {Promise<Object>} Paginated result with page items.
 */
export async function listKnowledgeBasePages(versionId, section = "") {
  return pbList(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
    filter: knowledgeBaseFilter(versionId, section),
    sort: "section,order,title",
    perPage: 500,
  });
}

/**
 * Lists Knowledge Base pages for admin list screens.
 *
 * @param {string} versionId - Version record ID.
 * @param {string} section - Knowledge Base section.
 * @param {number} [page=1] - 1-based page number.
 * @param {string} [search=""] - Optional title or slug search term.
 * @returns {Promise<Object>} Paginated result with page items.
 */
export async function listKnowledgeBasePagesPaginated(versionId, section, page = PAGINATION.DEFAULT_PAGE, search = "") {
  let filter = knowledgeBaseFilter(versionId, section);
  if (search) {
    filter += ` && (title ~ "${pbFilterValue(search)}" || slug ~ "${pbFilterValue(search)}")`;
  }

  return pbList(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
    filter,
    sort: "order,title",
    page,
    perPage: PAGINATION.DEFAULT_PER_PAGE,
  });
}

/**
 * Retrieves a Knowledge Base page by ID.
 *
 * @param {string} pageId - Knowledge Base page record ID.
 * @returns {Promise<Object>} Page record.
 * @throws {NotFoundError} If the page does not exist.
 */
export async function getKnowledgeBasePage(pageId) {
  const page = await pbGetOne(COLLECTIONS.KNOWLEDGE_BASE_PAGES, pageId, { expand: "version" });
  if (!page) {
    throw new NotFoundError("Knowledge Base page");
  }
  return page;
}

/**
 * Retrieves a Knowledge Base page by version, section, and slug.
 *
 * @param {string} versionId - Version record ID.
 * @param {string} section - Knowledge Base section.
 * @param {string} slug - Page slug.
 * @returns {Promise<Object|null>} Matching page, or null.
 */
export async function getKnowledgeBasePageBySlug(versionId, section, slug) {
  return pbGetFirstByFilter(COLLECTIONS.KNOWLEDGE_BASE_PAGES, `${knowledgeBaseFilter(versionId, section)} && slug = "${pbFilterValue(slug)}"`);
}

function assertParentAllowedFromPages(pages, parentId, currentPageId = "") {
  if (!parentId) return;

  const pageMap = new Map((pages || []).map((page) => [page.id, page]));
  const parent = pageMap.get(parentId);
  if (!parent) {
    throw new ValidationError("Parent article must belong to the same Knowledge Base section.");
  }

  if (currentPageId && parentId === currentPageId) {
    throw new ValidationError("An article cannot be its own parent.");
  }

  let cursor = parent;
  const seen = new Set();
  while (cursor?.parent) {
    if (cursor.parent === currentPageId) {
      throw new ValidationError("Parent article cannot be a child of this article.");
    }
    if (seen.has(cursor.parent)) {
      throw new ValidationError("Knowledge Base article hierarchy contains a cycle.");
    }
    seen.add(cursor.parent);
    cursor = pageMap.get(cursor.parent);
  }
}

async function rollbackImportedKnowledgeBasePages(createdPages, requestId) {
  const failures = [];

  for (const page of createdPages) {
    try {
      const deleted = await pbDelete(COLLECTIONS.KNOWLEDGE_BASE_PAGES, page.id);
      if (!deleted.ok) {
        failures.push(page.id);
      }
    } catch (err) {
      failures.push(page.id);
      logger.warn("Failed to rollback imported Knowledge Base article", { requestId, pageId: page.id, error: err.message });
    }
  }

  if (failures.length > 0) {
    logger.warn("Knowledge Base Markdown import rollback finished with failures", { requestId, failedCount: failures.length });
  }
}

/**
 * Creates a Knowledge Base page in a version section.
 *
 * @param {string} versionId - Version record ID.
 * @param {Object} data - Page data.
 * @param {string} data.section - Knowledge Base section.
 * @param {string} data.title - Page title.
 * @param {string} data.slug - URL slug.
 * @param {string} [data.content] - Markdown content.
 * @param {string} [data.parent] - Parent page ID.
 * @param {string} [data.icon] - Phosphor icon name.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<Object>} Created page.
 * @throws {ConflictError|ValidationError} If creation is invalid.
 */
export async function createKnowledgeBasePage(versionId, data, requestId) {
  const section = assertKnowledgeBaseSection(data.section);
  const [existing, allPages] = await Promise.all([getKnowledgeBasePageBySlug(versionId, section, data.slug), listKnowledgeBasePages(versionId, section)]);
  if (existing) {
    throw new ConflictError("A Knowledge Base article with this slug already exists in this section.");
  }

  const pages = allPages.items || [];
  assertParentAllowedFromPages(pages, data.parent || "");
  const maxOrder = pages.reduce((max, page) => Math.max(max, page.order || 0), 0);

  const result = await pbCreate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
    version: versionId,
    section,
    title: data.title,
    slug: data.slug,
    content: data.content || "",
    parent: data.parent || "",
    icon: data.icon || "",
    order: maxOrder + 1,
  });

  if (!result.ok) {
    throw new ValidationError("Failed to create Knowledge Base article.");
  }

  logger.info("Knowledge Base page created", { requestId, pageId: result.data.id, versionId, section });
  return result.data;
}

/**
 * Imports Markdown files as Knowledge Base articles, preserving relative folders.
 *
 * @param {string} versionId - Version record ID.
 * @param {string} section - Knowledge Base section.
 * @param {Array<{ filename: string, content: string }>} files - Markdown file payloads.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<Array<Object>>} Created Knowledge Base articles.
 * @throws {ConflictError|ValidationError} If import data or storage writes are invalid.
 */
export async function importKnowledgeBaseMarkdownPages(versionId, section, files, requestId) {
  const normalizedSection = assertKnowledgeBaseSection(section);
  const normalizedFiles = normalizeMarkdownImportFiles(files);
  const importPlan = buildMarkdownImportHierarchy(normalizedFiles);
  const pagesResult = await listKnowledgeBasePages(versionId, normalizedSection);
  const existingPages = pagesResult.items || [];
  const existingPageBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  const existingSlugs = new Set(existingPages.map((page) => page.slug));
  const existingConflicts = [];

  if (importPlan.duplicateSlugs.length > 0) {
    throw new ValidationError(`Markdown import contains duplicate article slugs: ${formatMarkdownImportSlugList(importPlan.duplicateSlugs)}.`);
  }

  for (const file of importPlan.files) {
    if (existingSlugs.has(file.slug)) {
      existingConflicts.push(file.slug);
    }
  }

  if (existingConflicts.length > 0) {
    throw new ConflictError(`Knowledge Base articles already exist for these slugs: ${formatMarkdownImportSlugList(existingConflicts)}.`);
  }

  let nextOrder = existingPages.reduce((max, page) => Math.max(max, page.order || 0), 0) + 1;
  const createdPages = [];
  const folderIdByKey = new Map();

  try {
    for (const folder of importPlan.folders) {
      const parent = folder.parentKey ? folderIdByKey.get(folder.parentKey) || "" : "";
      const existing = existingPageBySlug.get(folder.slug);

      if (existing) {
        if ((existing.parent || "") !== parent) {
          throw new ConflictError(`Cannot preserve folder hierarchy because the slug ${folder.slug} already exists under another parent.`);
        }
        folderIdByKey.set(folder.key, existing.id);
        continue;
      }

      const result = await pbCreate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
        version: versionId,
        section: normalizedSection,
        title: folder.title,
        slug: folder.slug,
        content: "",
        parent,
        icon: "",
        order: nextOrder,
      });

      if (!result.ok) {
        const details = formatMarkdownImportPbErrors(result.data);
        if (result.status === 409 || isPocketBaseUniqueSlugError(result.data)) {
          throw new ConflictError("A Knowledge Base folder with one of these slugs already exists.");
        }
        throw new ValidationError("Failed to import Markdown folders.", details);
      }

      nextOrder += 1;
      createdPages.push(result.data);
      folderIdByKey.set(folder.key, result.data.id);
    }

    for (const file of importPlan.files) {
      const result = await pbCreate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
        version: versionId,
        section: normalizedSection,
        title: file.title,
        slug: file.slug,
        content: file.content,
        parent: file.parentKey ? folderIdByKey.get(file.parentKey) || "" : "",
        icon: "",
        order: nextOrder,
      });

      if (!result.ok) {
        const details = formatMarkdownImportPbErrors(result.data);
        if (result.status === 409 || isPocketBaseUniqueSlugError(result.data)) {
          throw new ConflictError("A Knowledge Base article with one of these slugs already exists.");
        }
        throw new ValidationError("Failed to import Markdown articles.", details);
      }

      nextOrder += 1;
      createdPages.push(result.data);
    }
  } catch (err) {
    await rollbackImportedKnowledgeBasePages(createdPages, requestId);
    throw err;
  }

  logger.info("Knowledge Base Markdown pages imported", { requestId, versionId, section: normalizedSection, count: createdPages.length });
  return createdPages;
}

/**
 * Updates an existing Knowledge Base page.
 *
 * @param {string} pageId - Knowledge Base page record ID.
 * @param {Object} data - Update data.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<Object>} Updated page.
 * @throws {ConflictError|ValidationError|NotFoundError} If update is invalid.
 */
export async function updateKnowledgeBasePage(pageId, data, requestId) {
  const page = await getKnowledgeBasePage(pageId);

  if (data.slug && data.slug !== page.slug) {
    const existing = await getKnowledgeBasePageBySlug(page.version, page.section, data.slug);
    if (existing && existing.id !== pageId) {
      throw new ConflictError("A Knowledge Base article with this slug already exists in this section.");
    }
  }

  if (data.parent !== undefined) {
    const allPages = await listKnowledgeBasePages(page.version, page.section);
    assertParentAllowedFromPages(allPages.items || [], data.parent || "", pageId);
  }

  const result = await pbUpdate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, pageId, data);
  if (!result.ok) {
    throw new ValidationError("Failed to update Knowledge Base article.");
  }

  logger.info("Knowledge Base page updated", { requestId, pageId, versionId: page.version, section: page.section });
  return result.data;
}

/**
 * Deletes a Knowledge Base page and re-parents its children.
 *
 * @param {string} pageId - Knowledge Base page record ID.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<void>}
 */
export async function deleteKnowledgeBasePage(pageId, requestId) {
  const page = await getKnowledgeBasePage(pageId);

  const children = await pbList(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
    filter: `parent = "${pbFilterValue(pageId)}"`,
    perPage: 200,
  });
  await Promise.all((children.items || []).map((child) => pbUpdate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, child.id, { parent: page.parent || "" })));

  const result = await pbDelete(COLLECTIONS.KNOWLEDGE_BASE_PAGES, pageId);
  if (!result.ok) {
    throw new NotFoundError("Knowledge Base page");
  }

  logger.info("Knowledge Base page deleted", { requestId, pageId, versionId: page.version, section: page.section });
}

function assertReorderDoesNotCreateCycle(pageMap, pageId, parentId) {
  let cursorId = parentId;
  const seen = new Set([pageId]);

  while (cursorId) {
    if (seen.has(cursorId)) {
      throw new ValidationError("Knowledge Base article hierarchy contains a cycle.");
    }
    seen.add(cursorId);
    cursorId = pageMap.get(cursorId)?.parent || "";
  }
}

/**
 * Reorders Knowledge Base pages within a version section.
 *
 * @param {string} versionId - Version record ID.
 * @param {string} section - Knowledge Base section.
 * @param {Array<{ id: string, order: number, parent: string }>} updates - Reorder instructions.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<void>}
 */
export async function reorderKnowledgeBasePages(versionId, section, updates, requestId) {
  const normalizedSection = assertKnowledgeBaseSection(section);
  const pagesResult = await listKnowledgeBasePages(versionId, normalizedSection);
  const pageMap = new Map((pagesResult.items || []).map((page) => [page.id, page]));
  const proposedPageMap = new Map(pageMap);

  for (const update of updates) {
    if (!pageMap.has(update.id)) {
      throw new ValidationError("Reorder data contains an article outside this Knowledge Base section.");
    }
    if (update.parent && !pageMap.has(update.parent)) {
      throw new ValidationError("Parent article must belong to the same Knowledge Base section.");
    }
    proposedPageMap.set(update.id, { ...pageMap.get(update.id), parent: update.parent || "" });
  }

  for (const update of updates) {
    assertReorderDoesNotCreateCycle(proposedPageMap, update.id, update.parent || "");
  }

  const results = await Promise.all(updates.map((update) => pbUpdate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, update.id, { order: update.order, parent: update.parent || "" })));
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    logger.warn("Some Knowledge Base reorder operations failed", {
      requestId,
      failedCount: failed.length,
      versionId,
      section: normalizedSection,
    });
  }

  logger.info("Knowledge Base pages reordered", { requestId, versionId, section: normalizedSection, count: updates.length });
}

/**
 * Searches Knowledge Base pages within a project.
 *
 * @param {string} projectId - Project record ID.
 * @param {string} query - Search query.
 * @param {string|null} [versionId=null] - Optional version scope.
 * @param {boolean} [isAdmin=false] - Whether draft/private content is visible.
 * @returns {Promise<Array<Object>>} Matching page records.
 */
export async function searchKnowledgeBasePages(projectId, query, versionId = null, isAdmin = false) {
  const safeQuery = query.replace(/['"\\]/g, "");
  if (!safeQuery || safeQuery.length < 2) {
    return [];
  }

  let filter = isAdmin ? `version.project = "${pbFilterValue(projectId)}"` : `version.project = "${pbFilterValue(projectId)}" && version.is_public = true`;
  if (versionId) {
    filter += ` && version = "${pbFilterValue(versionId)}"`;
  }
  filter += ` && (title ~ "${pbFilterValue(safeQuery)}" || slug ~ "${pbFilterValue(safeQuery)}" || content ~ "${pbFilterValue(safeQuery)}")`;

  const result = await pbList(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
    filter,
    perPage: 20,
    expand: "version",
    fields: "id,title,slug,section,version,expand.version.label,expand.version.slug",
  });

  return result.items || [];
}

function sortPagesForClone(pages) {
  const sorted = [];
  const remaining = [...pages];
  const processed = new Set();

  for (let i = remaining.length - 1; i >= 0; i -= 1) {
    if (!remaining[i].parent) {
      sorted.push(remaining[i]);
      processed.add(remaining[i].id);
      remaining.splice(i, 1);
    }
  }

  let safety = remaining.length + 1;
  while (remaining.length > 0 && safety > 0) {
    safety -= 1;
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      if (processed.has(remaining[i].parent)) {
        sorted.push(remaining[i]);
        processed.add(remaining[i].id);
        remaining.splice(i, 1);
      }
    }
  }

  sorted.push(...remaining);
  return sorted;
}

/**
 * Clones all Knowledge Base pages from one version to another.
 *
 * @param {string} sourceVersionId - Source version ID.
 * @param {string} targetVersionId - Target version ID.
 * @param {string} requestId - Request ID for logs.
 * @returns {Promise<void>}
 */
export async function cloneKnowledgeBasePages(sourceVersionId, targetVersionId, requestId) {
  const sourcePagesResult = await listKnowledgeBasePages(sourceVersionId);
  const sourcePages = sortPagesForClone(sourcePagesResult.items || []);
  const idMap = new Map();

  for (const page of sourcePages) {
    const newParent = page.parent ? idMap.get(page.parent) || "" : "";
    const cloned = await pbCreate(COLLECTIONS.KNOWLEDGE_BASE_PAGES, {
      version: targetVersionId,
      section: page.section,
      title: page.title,
      slug: page.slug,
      content: page.content || "",
      parent: newParent,
      icon: page.icon || "",
      order: page.order || 0,
    });
    if (cloned.ok) {
      idMap.set(page.id, cloned.data.id);
    }
  }

  logger.info("Knowledge Base pages cloned", {
    requestId,
    sourceVersionId,
    targetVersionId,
    pagesCloned: idMap.size,
  });
}
