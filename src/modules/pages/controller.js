/**
 * @module pages/controller
 * @description Express routes for CRUD operations on documentation pages
 * within a project version.
 */
import { Router } from "express";
import { listPages, buildPageTree, getPage, createPage, updatePage, deletePage, reorderPages } from "./service.js";
import { createPageSchema, updatePageSchema, reorderPagesSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getVersion } from "../versions/service.js";
import { ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { renderMarkdown } from "../../lib/markdown.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPages(req.params.versionId)]);
    const project = version.expand?.project;

    const pageTree = buildPageTree(pagesResult.items || []);
    const totalPages = (pagesResult.items || []).length;

    res.render("admin/pages/index", {
      title: `${project.name} - ${version.label} - Pages`,
      headerSubtitle: `${totalPages} page${totalPages !== 1 ? "s" : ""}`,
      project,
      version,
      pages: pagesResult.items || [],
      pageTree,
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

    res.render("admin/pages/editor", {
      title: "New Page",
      project,
      version,
      page: null,
      pages: pagesResult.items || [],
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      extraCss: "/css/easymde.css",
      extraJs: ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"],
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
      return res.status(422).render("admin/pages/editor", {
        title: "New Page",
        project,
        version,
        page: null,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: firstIssue.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: "/css/easymde.css",
        extraJs: ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"],
      });
    }

    const page = await createPage(req.params.versionId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages/${page.id}?success=Page created.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const [version, pagesResult] = await Promise.all([getVersion(req.params.versionId), listPages(req.params.versionId)]);
      const project = version.expand?.project;
      return res.status(err.statusCode).render("admin/pages/editor", {
        title: "New Page",
        project,
        version,
        page: null,
        pages: pagesResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
        extraCss: "/css/easymde.css",
        extraJs: ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"],
      });
    }
    next(err);
  }
});

router.get("/:pageId", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [version, page, pagesResult] = await Promise.all([getVersion(req.params.versionId), getPage(req.params.pageId), listPages(req.params.versionId)]);
    const project = version.expand?.project;

    res.render("admin/pages/editor", {
      title: `Edit - ${page.title}`,
      project,
      version,
      page,
      pages: pagesResult.items || [],
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      extraCss: "/css/easymde.css",
      extraJs: ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"],
    });
  } catch (err) {
    next(err);
  }
});

router.post("/preview", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const html = renderMarkdown(req.body?.content || "");
    res.json({ html });
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

    await reorderPages(parsed.data.pages, req.requestId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:pageId", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), validate(updatePageSchema), async (req, res, next) => {
  try {
    await updatePage(req.params.pageId, req.validatedBody, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages/${req.params.pageId}?success=Page saved.`);
  } catch (err) {
    next(err);
  }
});

router.post("/:pageId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    await deletePage(req.params.pageId, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/pages?success=Page deleted.`);
  } catch (err) {
    next(err);
  }
});

export default router;
