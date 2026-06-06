/**
 * @module versions/controller
 * @description Express routes for CRUD operations on project versions.
 */
import { Router } from "express";
import { listVersions, getVersion, createVersion, updateVersion, deleteVersion } from "./service.js";
import { createVersionSchema, updateVersionSchema } from "./validation.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getProject } from "../projects/service.js";
import { ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", requireProjectAccess(), async (req, res) => {
  res.redirect(`/admin/projects/${req.params.projectId}`);
});

router.get("/create", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const [project, versionsResult] = await Promise.all([getProject(req.params.projectId), listVersions(req.params.projectId)]);
    res.render("admin/versions/create", {
      title: `${project.name} - New Version`,
      project,
      existingVersions: versionsResult.items || [],
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      formValues: null,
      siteName: env.SITE_NAME,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const [project, versionsResult] = await Promise.all([getProject(req.params.projectId), listVersions(req.params.projectId)]);
      return res.status(422).render("admin/versions/create", {
        title: `${project.name} - New Version`,
        project,
        existingVersions: versionsResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: firstIssue.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
      });
    }

    await createVersion(req.params.projectId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}?success=Version created.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const [project, versionsResult] = await Promise.all([getProject(req.params.projectId), listVersions(req.params.projectId)]);
      return res.status(err.statusCode).render("admin/versions/create", {
        title: `${project.name} - New Version`,
        project,
        existingVersions: versionsResult.items || [],
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        formValues: req.body,
        siteName: env.SITE_NAME,
      });
    }
    next(err);
  }
});

router.get("/:versionId/edit", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const version = await getVersion(req.params.versionId);
    const project = version.expand?.project;
    res.render("admin/versions/edit", {
      title: `${project.name} - ${version.label}`,
      project,
      version,
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: null,
      success: req.query.success || null,
      formValues: null,
      siteName: env.SITE_NAME,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:versionId", csrfMiddleware, requireProjectAccess(ROLES.ADMIN, ROLES.EDITOR), async (req, res, next) => {
  try {
    const parsed = updateVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const version = await getVersion(req.params.versionId);
      const project = version.expand?.project;
      return res.status(422).render("admin/versions/edit", {
        title: `${project.name} - ${version.label}`,
        project,
        version,
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: firstIssue.message,
        success: null,
        formValues: req.body,
        siteName: env.SITE_NAME,
      });
    }

    await updateVersion(req.params.versionId, parsed.data, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/edit?success=Version updated.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const version = await getVersion(req.params.versionId);
      const project = version.expand?.project;
      return res.status(err.statusCode).render("admin/versions/edit", {
        title: `${project.name} - ${version.label}`,
        project,
        version,
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        success: null,
        formValues: req.body,
        siteName: env.SITE_NAME,
      });
    }
    next(err);
  }
});

router.post("/:versionId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    await deleteVersion(req.params.versionId, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}`);
  } catch (err) {
    next(err);
  }
});

export default router;
