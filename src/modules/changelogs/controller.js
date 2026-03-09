import { Router } from "express";
import { getChangelog, upsertChangelog } from "./service.js";
import { updateChangelogSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getVersion } from "../versions/service.js";
import { ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [version, changelog] = await Promise.all([getVersion(req.params.versionId), getChangelog(req.params.versionId)]);
    const project = version.expand?.project;

    res.render("admin/changelogs/editor", {
      title: `${project.name} - ${version.label} - Changelog`,
      project,
      version,
      changelog,
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

router.post("/", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), validate(updateChangelogSchema), async (req, res, next) => {
  try {
    await upsertChangelog(req.params.versionId, req.validatedBody, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}/versions/${req.params.versionId}/changelog?success=Changelog saved.`);
  } catch (err) {
    next(err);
  }
});

export default router;
