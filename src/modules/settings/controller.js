/**
 * @module settings/controller
 * @description Express routes for managing site settings and IP restriction
 * configuration in the admin panel.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { getSettings, updateSettings } from "./service.js";
import { getIpRestriction, updateIpRestriction } from "./ip-restriction-service.js";
import { updateAllSettingsSchema, updateSettingsSchema } from "./validation.js";
import { ROLES } from "../../config/constants.js";
import { AuthorizationError, ValidationError } from "../../errors/taxonomy.js";
import { getClientIp } from "../../lib/request-ip.js";

const router = Router();

function parseSettingsBody(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    code: issue.code.toUpperCase(),
    message: issue.message,
  }));

  throw new ValidationError("One or more fields are invalid.", details);
}

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.OWNER), csrfMiddleware);

router.get("/", (req, res) => {
  const settings = getSettings();
  const canManageIpRestriction = req.user.role === ROLES.OWNER;
  res.render("admin/settings/index", {
    title: "Settings",
    user: req.user,
    csrfToken: res.locals.csrfToken,
    settings,
    canManageIpRestriction,
    ipRestriction: canManageIpRestriction ? getIpRestriction() : null,
    detectedIp: canManageIpRestriction ? getClientIp(req) : null,
    error: req.query.error || null,
    success: req.query.success || null,
  });
});

router.post("/", async (req, res, next) => {
  try {
    const canManageIpRestriction = req.user.role === ROLES.OWNER;
    const requestedIpRestrictionUpdate = Object.prototype.hasOwnProperty.call(req.body, "enabled") || Object.prototype.hasOwnProperty.call(req.body, "allowedIps");

    if (!canManageIpRestriction && requestedIpRestrictionUpdate) {
      throw new AuthorizationError("Only owners can update IP restriction settings.");
    }

    const validatedBody = parseSettingsBody(canManageIpRestriction ? updateAllSettingsSchema : updateSettingsSchema, req.body);
    const { heroWord1, heroWord2, heroSubtitle } = validatedBody;

    await updateSettings({ heroWord1, heroWord2, heroSubtitle }, req.requestId);

    if (canManageIpRestriction) {
      const { enabled, allowedIps } = validatedBody;
      const currentIp = getClientIp(req);
      await updateIpRestriction({ enabled, allowedIps }, req.requestId, currentIp);
    }

    res.redirect("/admin/settings?success=Settings saved successfully.");
  } catch (err) {
    next(err);
  }
});

export default router;
