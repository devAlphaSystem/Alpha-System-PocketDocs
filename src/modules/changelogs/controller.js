/**
 * @module changelogs/controller
 * @description Express routes for managing version changelogs in the admin panel.
 */
import { Router } from "express";
import { getChangelog, upsertChangelog } from "./service.js";
import { updateChangelogSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireProjectAccess } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getVersion } from "../versions/service.js";
import { PROJECT_MODE, ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { NotFoundError } from "../../errors/taxonomy.js";

const router = Router({ mergeParams: true });
const EDITOR_EXTRA_CSS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.css", "/css/easymde.css"];
const EDITOR_EXTRA_JS = ["https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist/easymde.min.js", "/js/editor.js"];

router.use(requireAuth);

function assertChangelogSupported(project) {
  if ((project?.mode || PROJECT_MODE.VERSIONED) !== PROJECT_MODE.VERSIONED) {
    throw new NotFoundError("Changelog");
  }
}

router.get("/", csrfMiddleware, requireProjectAccess(), async (req, res, next) => {
  try {
    const [version, changelog] = await Promise.all([getVersion(req.params.versionId), getChangelog(req.params.versionId)]);
    const project = version.expand?.project;
    assertChangelogSupported(project);

    if (!req.xhr) {
      return res.redirect(303, `/admin/projects/${project.id}`);
    }

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
      extraCss: EDITOR_EXTRA_CSS,
      extraJs: EDITOR_EXTRA_JS,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", csrfMiddleware, requireProjectAccess(ROLES.ADMIN), validate(updateChangelogSchema), async (req, res, next) => {
  try {
    const version = await getVersion(req.params.versionId);
    assertChangelogSupported(version.expand?.project);
    await upsertChangelog(req.params.versionId, req.validatedBody, req.requestId);
    res.redirect(`/admin/projects/${req.params.projectId}?success=Changelog saved.`);
  } catch (err) {
    next(err);
  }
});

export default router;
