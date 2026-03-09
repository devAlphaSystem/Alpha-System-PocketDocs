import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { getSettings, updateSettings } from "./service.js";
import { getIpRestriction, updateIpRestriction } from "./ip-restriction-service.js";
import { updateAllSettingsSchema } from "./validation.js";
import { ROLES } from "../../config/constants.js";

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.OWNER), csrfMiddleware);

router.get("/", (req, res) => {
  const settings = getSettings();
  const ipRestriction = getIpRestriction();
  res.render("admin/settings/index", {
    title: "Settings",
    user: req.user,
    csrfToken: res.locals.csrfToken,
    settings,
    ipRestriction,
    error: req.query.error || null,
    success: req.query.success || null,
  });
});

router.post("/", validate(updateAllSettingsSchema), async (req, res, next) => {
  try {
    const { headerBrand, heroWord1, heroWord2, heroSubtitle, enabled, allowedIps } = req.validatedBody;
    await updateSettings({ headerBrand, heroWord1, heroWord2, heroSubtitle });
    await updateIpRestriction({ enabled, allowedIps });
    res.redirect("/admin/settings?success=Settings saved successfully.");
  } catch (err) {
    next(err);
  }
});

export default router;
