import { Router } from "express";
import { listProjects, getProject, createProject, updateProject, deleteProject, listMembers, addMember, removeMember, updateMemberRole } from "./service.js";
import { listVersions } from "../versions/service.js";
import { createProjectSchema, updateProjectSchema, addMemberSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";

const router = Router();

router.use(requireAuth);

router.get("/", csrfMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await listProjects(req.user.id, req.user.role, page);
    const totalProjects = result.totalItems ?? (result.items || []).length;
    res.render("admin/projects/index", {
      title: "Projects",
      headerSubtitle: `${totalProjects} project${totalProjects !== 1 ? "s" : ""}`,
      projects: result.items || [],
      pagination: { page: result.page, totalPages: result.totalPages, totalItems: result.totalItems },
      user: req.user,
      csrfToken: res.locals.csrfToken,
      siteName: env.SITE_NAME,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/create", csrfMiddleware, (req, res) => {
  res.render("admin/projects/create", {
    title: "New Project",
    user: req.user,
    csrfToken: res.locals.csrfToken,
    error: null,
    values: {},
    siteName: env.SITE_NAME,
  });
});

router.post("/create", csrfMiddleware, validate(createProjectSchema), async (req, res, next) => {
  try {
    const project = await createProject(req.validatedBody, req.user.id, req.requestId);
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
      });
    }
    next(err);
  }
});

router.get("/:projectId", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [project, versionsResult] = await Promise.all([getProject(req.params.projectId), listVersions(req.params.projectId)]);
    res.render("admin/projects/show", {
      title: project.name,
      headerSubtitle: `/${project.slug}`,
      headerBadge: {
        text: project.visibility,
        variant: project.visibility,
      },
      project,
      versions: versionsResult.items || [],
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
    res.redirect("/admin/projects?success=Project deleted.");
  } catch (err) {
    next(err);
  }
});

router.get("/:projectId/members", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const [project, membersResult] = await Promise.all([getProject(req.params.projectId), listMembers(req.params.projectId)]);
    const totalMembers = (membersResult.items || []).length;
    res.render("admin/projects/members", {
      title: `${project.name} - Members`,
      headerSubtitle: `${totalMembers} member${totalMembers !== 1 ? "s" : ""}`,
      project,
      members: membersResult.items || [],
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

router.post("/:projectId/members", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), validate(addMemberSchema), async (req, res, next) => {
  try {
    await addMember(req.params.projectId, req.validatedBody.email, req.validatedBody.role, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/members?success=Member added.`);
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 409) {
      const [project, membersResult] = await Promise.all([getProject(req.params.projectId), listMembers(req.params.projectId)]);
      const totalMembers = (membersResult.items || []).length;
      return res.status(err.statusCode).render("admin/projects/members", {
        title: `${project.name} - Members`,
        headerSubtitle: `${totalMembers} member${totalMembers !== 1 ? "s" : ""}`,
        project,
        members: membersResult.items || [],
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

router.post("/:projectId/members/:memberId/role", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["admin", "editor", "viewer"].includes(role)) {
      return res.redirect(`/admin/projects/${req.params.projectId}/members`);
    }
    await updateMemberRole(req.params.memberId, role, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/members?success=Role updated.`);
  } catch (err) {
    next(err);
  }
});

router.post("/:projectId/members/:memberId/delete", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), async (req, res, next) => {
  try {
    await removeMember(req.params.memberId, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/members?success=Member removed.`);
  } catch (err) {
    next(err);
  }
});

export default router;
