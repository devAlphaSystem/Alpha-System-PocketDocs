/**
 * @module pages/controller
 * @description Express routes for CRUD operations on documentation pages
 * within a project version.
 */
import { Router } from "express";
import { listPages, listPagesPaginated, buildPageTree, getPage, createPage, updatePage, deletePage, reorderPages } from "./service.js";
import { createPageSchema, updatePageSchema, reorderPagesSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getVersion } from "../versions/service.js";
import { ROLES, PROJECT_MODE } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { NotFoundError } from "../../errors/taxonomy.js";

const router = Router({ mergeParams: true });
const EDITOR_EXTRA_CSS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css", "/css/easymde.css"];
const EDITOR_EXTRA_JS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"];

router.use(requireAuth);

function supportsDocs(project) {
  const mode = project?.mode || PROJECT_MODE.VERSIONED;
  return mode === PROJECT_MODE.VERSIONED || mode === PROJECT_MODE.DOCUMENTATION;
}

function isDocsOnly(project) {
  return (project?.mode || PROJECT_MODE.VERSIONED) === PROJECT_MODE.DOCUMENTATION;
}

function assertPageBelongsToVersion(page, versionId) {
  if (page.version !== versionId) {
    throw new NotFoundError("Page");
  }
}

router.get("/", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = (req.query.search || "").trim();
    const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPagesPaginated(req.params.versionId, page, search)]);
    const project = version.expand?.project;
    if (!supportsDocs(project)) {
      throw new NotFoundError("Pages");
    }
    const docsOnlyMode = isDocsOnly(project);

    const pageTree = search ? [] : buildPageTree(pagesResult.items || []);
    const totalPages = pagesResult.totalItems ?? (pagesResult.items || []).length;

    res.render("admin/pages/index", {
      title: docsOnlyMode ? `${project.name} - Pages` : `${project.name} - ${version.label} - Pages`,
      headerSubtitle: `${totalPages} page${totalPages !== 1 ? "s" : ""}`,
      headerSearch: {
        action: `/admin/projects/${project.id}/versions/${version.id}/pages`,
        placeholder: "Search pages...",
        value: search,
      },
      project,
      version,
      docsOnlyMode,
      pages: pagesResult.items || [],
      pageTree,
      pagination: { page: pagesResult.page, totalPages: pagesResult.totalPages, totalItems: pagesResult.totalItems },
      search,
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/new", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPages(req.params.versionId)]);
    const project = version.expand?.project;
    if (!supportsDocs(project)) {
      throw new NotFoundError("Pages");
    }
    const docsOnlyMode = isDocsOnly(project);

    res.render("admin/pages/editor", {
      title: "New Page",
      project,
      version,
      docsOnlyMode,
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

router.post("/new", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPages(req.params.versionId)]);
      const project = version.expand?.project;
      if (!supportsDocs(project)) {
        throw new NotFoundError("Pages");
      }
      const docsOnlyMode = isDocsOnly(project);
      return res.status(422).render("admin/pages/editor", {
        title: "New Page",
        project,
        version,
        docsOnlyMode,
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

    const version = await getVersion(req.params.versionId);
    if (!supportsDocs(version.expand?.project)) {
      throw new NotFoundError("Pages");
    }
    const page = await createPage(req.params.versionId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages/${page.id}?success=Page created.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPages(req.params.versionId)]);
      const project = version.expand?.project;
      if (!supportsDocs(project)) {
        throw new NotFoundError("Pages");
      }
      const docsOnlyMode = isDocsOnly(project);
      return res.status(err.statusCode).render("admin/pages/editor", {
        title: "New Page",
        project,
        version,
        docsOnlyMode,
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

router.get("/:pageId", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [version, page, pagesResult] = await Promise.all([getVersion(req.params.versionId), getPage(req.params.pageId), listPages(req.params.versionId)]);
    const project = version.expand?.project;
    if (!supportsDocs(project)) {
      throw new NotFoundError("Pages");
    }
    assertPageBelongsToVersion(page, version.id);
    const docsOnlyMode = isDocsOnly(project);

    res.render("admin/pages/editor", {
      title: `Edit - ${page.title}`,
      project,
      version,
      docsOnlyMode,
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

router.post("/reorder", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), async (req, res, next) => {
  try {
    let pages;
    try {
      pages = typeof req.body.pages === "string" ? JSON.parse(req.body.pages) : req.body.pages;
    } catch (_e) {
      return res.status(400).json({ error: { code: "INVALID_FORMAT", message: "Invalid page order data." } });
    }

    const parsed = reorderPagesSchema.safeParse({ pages });
    if (!parsed.success) {
      return res.status(422).json({ error: { code: "VALIDATION_FAILED", message: "Invalid reorder data." } });
    }

    const version = await getVersion(req.params.versionId);
    if (!supportsDocs(version.expand?.project)) {
      throw new NotFoundError("Pages");
    }
    await reorderPages(req.params.versionId, parsed.data.pages, req.requestId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:pageId", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), validate(updatePageSchema), async (req, res, next) => {
  try {
    const [version, page] = await Promise.all([getVersion(req.params.versionId), getPage(req.params.pageId)]);
    if (!supportsDocs(version.expand?.project)) {
      throw new NotFoundError("Pages");
    }
    assertPageBelongsToVersion(page, version.id);
    await updatePage(req.params.pageId, req.validatedBody, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages/${req.params.pageId}?success=Page saved.`);
  } catch (err) {
    next(err);
  }
});

router.post("/:pageId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const [version, page] = await Promise.all([getVersion(req.params.versionId), getPage(req.params.pageId)]);
    if (!supportsDocs(version.expand?.project)) {
      throw new NotFoundError("Pages");
    }
    assertPageBelongsToVersion(page, version.id);
    await deletePage(req.params.pageId, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages?success=Page deleted.`);
  } catch (err) {
    next(err);
  }
});

export default router;
