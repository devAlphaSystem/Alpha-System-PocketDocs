/**
 * @module projects/controller
 * @description Express routes for CRUD operations on documentation projects.
 */
import { Router } from "express";
import { listProjects, getProject, createProject, updateProject, deleteProject } from "./service.js";
import { listVersionsPaginated, listVersions } from "../versions/service.js";
import { createProjectSchema, updateProjectSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireRole, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { ROLES, PROJECT_MODE } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { isGitHubConfigured } from "../github/service.js";
import { getClientIp } from "../../lib/request-ip.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../audit-logs/service.js";

const router = Router();

router.use(requireAuth);

router.get("/", csrfMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = (req.query.search || "").trim();
    const result = await listProjects(page, search);
    const totalProjects = result.totalItems ?? (result.items || []).length;
    res.render("admin/projects/index", {
      title: "Projects",
      headerSubtitle: `${totalProjects} project${totalProjects !== 1 ? "s" : ""}`,
      headerSearch: {
        action: "/admin/projects",
        placeholder: "Search projects...",
        value: search,
      },
      projects: result.items || [],
      pagination: { page: result.page, totalPages: result.totalPages, totalItems: result.totalItems },
      search,
      user: req.user,
      csrfToken: res.locals.csrfToken,
      siteName: env.SITE_NAME,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/create", csrfMiddleware, requireRole(ROLES.ADMIN, ROLES.OWNER), (req, res) => {
  res.render("admin/projects/create", {
    title: "New Project",
    user: req.user,
    csrfToken: res.locals.csrfToken,
    error: null,
    values: {},
    siteName: env.SITE_NAME,
    githubConfigured: isGitHubConfigured(),
  });
});

router.post("/create", csrfMiddleware, requireRole(ROLES.ADMIN, ROLES.OWNER), validate(createProjectSchema), async (req, res, next) => {
  try {
    const project = await createProject(req.validatedBody, req.user.id, req.requestId);
    recordAuditLog({ action: AUDIT_ACTIONS.PROJECT_CREATED, userId: req.user.id, userEmail: req.user.email, targetType: "project", targetId: project.id, description: `Created project "${req.validatedBody.name}" (/${req.validatedBody.slug})`, ipAddress: getClientIp(req) });
    res.redirect(`/admin/projects/${project.id}?success=Project created.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      return res.status(err.statusCode).render("admin/projects/create", {
        title: "New Project",
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        values: req.validatedBody,
        siteName: env.SITE_NAME,
        githubConfigured: isGitHubConfigured(),
      });
    }
    next(err);
  }
});

router.get("/:projectId", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const search = (req.query.search || "").trim();
    const project = await getProject(req.params.projectId);

    if ((project.mode || PROJECT_MODE.VERSIONED) === PROJECT_MODE.SIMPLE) {
      const versionsResult = await listVersions(project.id);
      const defaultVersion = versionsResult.items?.[0];
      if (!defaultVersion) {
        return res.render("admin/projects/show", {
          title: project.name,
          headerSubtitle: `/${project.slug}`,
          headerBadge: { text: project.visibility, variant: project.visibility },
          project,
          defaultVersion: null,
          pages: [],
          pageTree: [],
          pagination: { page: 1, totalPages: 1, totalItems: 0 },
          search,
          user: req.user,
          csrfToken: res.locals.csrfToken,
          success: req.query.success || null,
          siteName: env.SITE_NAME,
          sitePbUrl: env.POCKETBASE_URL,
        });
      }

      const query = new URLSearchParams();
      if (req.query.success) {
        query.set("success", String(req.query.success));
      }
      if (search) {
        query.set("search", search);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";
      return res.redirect(`/admin/projects/${project.id}/versions/${defaultVersion.id}/pages${suffix}`);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const versionsResult = await listVersionsPaginated(project.id, page, search);
    res.render("admin/projects/show", {
      title: project.name,
      headerSubtitle: `/${project.slug}`,
      headerBadge: {
        text: project.visibility,
        variant: project.visibility,
      },
      headerSearch: {
        action: `/admin/projects/${project.id}`,
        placeholder: "Search versions...",
        value: search,
      },
      project,
      versions: versionsResult.items || [],
      pagination: { page: versionsResult.page, totalPages: versionsResult.totalPages, totalItems: versionsResult.totalItems },
      search,
      user: req.user,
      csrfToken: res.locals.csrfToken,
      success: req.query.success || null,
      siteName: env.SITE_NAME,
      sitePbUrl: env.POCKETBASE_URL,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:projectId/edit", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const project = await getProject(req.params.projectId);
    res.render("admin/projects/edit", {
      title: `Edit - ${project.name}`,
      project,
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

router.post("/:projectId", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), validate(updateProjectSchema), async (req, res, next) => {
  try {
    await updateProject(req.params.projectId, req.validatedBody, req.requestId);
    recordAuditLog({ action: AUDIT_ACTIONS.PROJECT_UPDATED, userId: req.user.id, userEmail: req.user.email, targetType: "project", targetId: req.params.projectId, description: `Updated project`, ipAddress: getClientIp(req) });
    res.redirect(`/admin/projects/${req.params.projectId}?success=Project updated successfully.`);
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      const project = await getProject(req.params.projectId);
      return res.status(err.statusCode).render("admin/projects/edit", {
        title: project.name,
        project: { ...project, ...req.validatedBody },
        user: req.user,
        csrfToken: res.locals.csrfToken,
        error: err.message,
        success: null,
        siteName: env.SITE_NAME,
      });
    }
    next(err);
  }
});

router.post("/:projectId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    await deleteProject(req.params.projectId, req.requestId);
    recordAuditLog({ action: AUDIT_ACTIONS.PROJECT_DELETED, userId: req.user.id, userEmail: req.user.email, targetType: "project", targetId: req.params.projectId, description: `Deleted project`, ipAddress: getClientIp(req) });
    res.redirect("/admin/projects?success=Project deleted.");
  } catch (err) {
    next(err);
  }
});

export default router;
