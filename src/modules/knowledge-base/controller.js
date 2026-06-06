/**
 * @module knowledge-base/controller
 * @description Express routes for managing version Knowledge Base pages.
 */
import { Router } from "express";
import { KNOWLEDGE_BASE_SECTION_OPTIONS, assertKnowledgeBaseSection, buildKnowledgeBaseTree, createKnowledgeBasePage, deleteKnowledgeBasePage, getKnowledgeBasePage, getKnowledgeBaseSectionLabel, importKnowledgeBaseMarkdownPages, isKnowledgeBaseSection, listKnowledgeBasePages, listKnowledgeBasePagesPaginated, reorderKnowledgeBasePages, updateKnowledgeBasePage } from "./service.js";
import { createKnowledgeBasePageSchema, importKnowledgeBaseMarkdownPagesSchema, reorderKnowledgeBasePagesSchema, updateKnowledgeBasePageSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getVersion } from "../versions/service.js";
import { NotFoundError } from "../../errors/taxonomy.js";
import { KNOWLEDGE_BASE_SECTIONS, PROJECT_MODE, ROLES, MARKDOWN_IMPORT } from "../../config/constants.js";
import { env } from "../../config/env.js";

const router = Router({ mergeParams: true });
const EDITOR_EXTRA_CSS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css", "/css/easymde.css"];
const EDITOR_EXTRA_JS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"];

router.use(requireAuth);

function supportsKnowledgeBase(project) {
  const mode = project?.mode || PROJECT_MODE.VERSIONED;
  return mode === PROJECT_MODE.VERSIONED || mode === PROJECT_MODE.KNOWLEDGE_BASE;
}

function isSingleVersionProject(project) {
  const mode = project?.mode || PROJECT_MODE.VERSIONED;
  return mode === PROJECT_MODE.DOCUMENTATION || mode === PROJECT_MODE.KNOWLEDGE_BASE;
}

function userCanImport(user) {
  return user?.role === ROLES.OWNER || user?.role === ROLES.ADMIN;
}

async function getAdminContext(req) {
  const version = await getVersion(req.params.versionId);
  const project = version.expand?.project;
  if (!project || !supportsKnowledgeBase(project)) {
    throw new NotFoundError("Knowledge Base");
  }
  return {
    project,
    version,
    singleVersionMode: isSingleVersionProject(project),
  };
}

function knowledgeBaseAdminUrl(projectId, versionId, section = "") {
  const suffix = section ? `?section=${encodeURIComponent(section)}` : "";
  return `/admin/projects/${projectId}/versions/${versionId}/knowledge-base${suffix}`;
}

function assertPageBelongsToRoute(page, versionId, section) {
  if (page.version !== versionId || page.section !== section) {
    throw new NotFoundError("Knowledge Base page");
  }
}

router.get("/", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const selectedSection = isKnowledgeBaseSection(req.query.section) ? req.query.section : KNOWLEDGE_BASE_SECTIONS.FAQ;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = (req.query.search || "").trim();
    const { project, version, singleVersionMode } = await getAdminContext(req);
    const pagesResult = await listKnowledgeBasePagesPaginated(version.id, selectedSection, page, search);

    const pages = pagesResult.items || [];
    const pageTree = search ? [] : buildKnowledgeBaseTree(pages);
    const totalPages = pagesResult.totalItems ?? pages.length;
    const selectedSectionLabel = getKnowledgeBaseSectionLabel(selectedSection);

    res.render("admin/knowledge-base/index", {
      title: singleVersionMode ? `${project.name} - Knowledge Base` : `${project.name} - ${version.label} - Knowledge Base`,
      headerSubtitle: `${selectedSectionLabel} - ${totalPages} article${totalPages !== 1 ? "s" : ""}`,
      headerSearch: {
        action: knowledgeBaseAdminUrl(project.id, version.id),
        params: { section: selectedSection },
        placeholder: `Search ${selectedSectionLabel}...`,
        value: search,
      },
      project,
      version,
      singleVersionMode,
      section: selectedSection,
      sectionLabel: selectedSectionLabel,
      sectionOptions: KNOWLEDGE_BASE_SECTION_OPTIONS,
      pages,
      pageTree,
      pagination: { page: pagesResult.page, totalPages: pagesResult.totalPages, totalItems: pagesResult.totalItems },
      search,
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      markdownImport: MARKDOWN_IMPORT,
      extraJs: userCanImport(req.user) ? "/js/markdown-import.js" : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:section/new", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    const { project, version, singleVersionMode } = await getAdminContext(req);
    const pagesResult = await listKnowledgeBasePages(version.id, section);

    res.render("admin/knowledge-base/editor", {
      title: `New ${getKnowledgeBaseSectionLabel(section)} Article`,
      project,
      version,
      singleVersionMode,
      section,
      sectionLabel: getKnowledgeBaseSectionLabel(section),
      page: null,
      pages: pagesResult.items || [],
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      extraCss: EDITOR_EXTRA_CSS,
      extraJs: EDITOR_EXTRA_JS,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:section/new", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    const parsed = createKnowledgeBasePageSchema.safeParse({ ...req.body, section });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const { project, version, singleVersionMode } = await getAdminContext(req);
      const pagesResult = await listKnowledgeBasePages(version.id, section);
      return res.status(422).render("admin/knowledge-base/editor", {
        title: `New ${getKnowledgeBaseSectionLabel(section)} Article`,
        project,
        version,
        singleVersionMode,
        section,
        sectionLabel: getKnowledgeBaseSectionLabel(section),
        page: null,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: firstIssue.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: EDITOR_EXTRA_CSS,
        extraJs: EDITOR_EXTRA_JS,
      });
    }

    await getAdminContext(req);
    const page = await createKnowledgeBasePage(req.params.versionId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/knowledge-base/${section}/${page.id}?success=Knowledge Base article created.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const section = assertKnowledgeBaseSection(req.params.section);
      const { project, version, singleVersionMode } = await getAdminContext(req);
      const pagesResult = await listKnowledgeBasePages(version.id, section);
      return res.status(err.statusCode).render("admin/knowledge-base/editor", {
        title: `New ${getKnowledgeBaseSectionLabel(section)} Article`,
        project,
        version,
        singleVersionMode,
        section,
        sectionLabel: getKnowledgeBaseSectionLabel(section),
        page: null,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: EDITOR_EXTRA_CSS,
        extraJs: EDITOR_EXTRA_JS,
      });
    }
    next(err);
  }
});

router.post("/:section/reorder", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    let pages;
    try {
      pages = typeof req.body.pages === "string" ? JSON.parse(req.body.pages) : req.body.pages;
    } catch (_err) {
      return res.status(400).json({ error: { code: "INVALID_FORMAT", message: "Invalid Knowledge Base order data." } });
    }

    const parsed = reorderKnowledgeBasePagesSchema.safeParse({ pages });
    if (!parsed.success) {
      return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Invalid reorder data." } });
    }

    await getAdminContext(req);
    await reorderKnowledgeBasePages(req.params.versionId, section, parsed.data.pages, req.requestId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:section/import", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), validate(importKnowledgeBaseMarkdownPagesSchema), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    await getAdminContext(req);
    const pages = await importKnowledgeBaseMarkdownPages(req.params.versionId, section, req.validatedBody.files, req.requestId);
    const importedCount = pages.length;
    const successMessage = `${importedCount} article${importedCount !== 1 ? "s" : ""} imported.`;
    res.status(201).json({
      ok: true,
      importedCount,
      pages: pages.map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        section: page.section,
      })),
      redirectUrl: `${knowledgeBaseAdminUrl(req.params.projectId, req.params.versionId, section)}&success=${encodeURIComponent(successMessage)}`,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:section/:pageId", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    const { project, version, singleVersionMode } = await getAdminContext(req);
    const [page, pagesResult] = await Promise.all([getKnowledgeBasePage(req.params.pageId), listKnowledgeBasePages(version.id, section)]);
    assertPageBelongsToRoute(page, version.id, section);

    res.render("admin/knowledge-base/editor", {
      title: `Edit - ${page.title}`,
      project,
      version,
      singleVersionMode,
      section,
      sectionLabel: getKnowledgeBaseSectionLabel(section),
      page,
      pages: pagesResult.items || [],
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      extraCss: EDITOR_EXTRA_CSS,
      extraJs: EDITOR_EXTRA_JS,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:section/:pageId", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    const parsed = updateKnowledgeBasePageSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const { project, version, singleVersionMode } = await getAdminContext(req);
      const [page, pagesResult] = await Promise.all([getKnowledgeBasePage(req.params.pageId), listKnowledgeBasePages(version.id, section)]);
      assertPageBelongsToRoute(page, version.id, section);
      return res.status(422).render("admin/knowledge-base/editor", {
        title: `Edit - ${page.title}`,
        project,
        version,
        singleVersionMode,
        section,
        sectionLabel: getKnowledgeBaseSectionLabel(section),
        page,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: firstIssue.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: EDITOR_EXTRA_CSS,
        extraJs: EDITOR_EXTRA_JS,
      });
    }

    const existingPage = await getKnowledgeBasePage(req.params.pageId);
    assertPageBelongsToRoute(existingPage, req.params.versionId, section);
    await updateKnowledgeBasePage(req.params.pageId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/knowledge-base/${section}/${req.params.pageId}?success=Knowledge Base article saved.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const section = assertKnowledgeBaseSection(req.params.section);
      const { project, version, singleVersionMode } = await getAdminContext(req);
      const [page, pagesResult] = await Promise.all([getKnowledgeBasePage(req.params.pageId), listKnowledgeBasePages(version.id, section)]);
      assertPageBelongsToRoute(page, version.id, section);
      return res.status(err.statusCode).render("admin/knowledge-base/editor", {
        title: `Edit - ${page.title}`,
        project,
        version,
        singleVersionMode,
        section,
        sectionLabel: getKnowledgeBaseSectionLabel(section),
        page,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: EDITOR_EXTRA_CSS,
        extraJs: EDITOR_EXTRA_JS,
      });
    }
    next(err);
  }
});

router.post("/:section/:pageId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const section = assertKnowledgeBaseSection(req.params.section);
    const { version } = await getAdminContext(req);
    const page = await getKnowledgeBasePage(req.params.pageId);
    assertPageBelongsToRoute(page, version.id, section);
    await deleteKnowledgeBasePage(req.params.pageId, req.requestId);
    res.redirect(`${knowledgeBaseAdminUrl(req.params.projectId, req.params.versionId, section)}&success=Knowledge Base article deleted.`);
  } catch (err) {
    next(err);
  }
});

export default router;
