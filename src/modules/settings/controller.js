import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { getSettings, updateSettings } from "./service.js";
import { updateSettingsSchema } from "./validation.js";
import { ROLES } from "../../config/constants.js";

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN), csrfMiddleware);

router.get("/", (req, res) => {
  const settings = getSettings();
  res.render("admin/settings/index", {
    title: "Settings",
    user: req.user,
    csrfToken: res.locals.csrfToken,
    settings,
    error: req.query.error || null,
    success: req.query.success || null,
  });
});

router.post("/", validate(updateSettingsSchema), async (req, res, next) => {
  try {
    await updateSettings(req.validatedBody);
    res.redirect("/admin/settings?success=Settings saved successfully.");
  } catch (err) {
    next(err);
  }
});

export default router;
