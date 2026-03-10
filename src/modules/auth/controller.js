/**
 * @module auth/controller
 * @description Express routes for user authentication, including login and logout.
 */
import { Router } from "express";
import { loginUser } from "./service.js";
import { loginSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { COOKIE_NAMES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { clearAuthCache } from "../../middleware/auth.js";
import { logger } from "../../lib/logger.js";
import { getClientIp } from "../../lib/request-ip.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../audit-logs/service.js";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.get("/login", csrfMiddleware, (req, res) => {
  if (req.user) {
    return res.redirect("/admin");
  }
  res.render("admin/login", {
    layout: false,
    title: "Sign In",
    error: null,
    csrfToken: res.locals.csrfToken,
    siteName: env.SITE_NAME,
    mode: "login",
  });
});

router.post("/login", csrfMiddleware, validate(loginSchema), async (req, res, next) => {
  try {
    const { token, user } = await loginUser(req.validatedBody.email, req.validatedBody.password, req.requestId);
    res.cookie(COOKIE_NAMES.AUTH_TOKEN, token, cookieOptions);
    recordAuditLog({ action: AUDIT_ACTIONS.AUTH_LOGIN, userId: user.id, userEmail: user.email, description: `User logged in`, ipAddress: getClientIp(req) });
    res.redirect("/admin");
  } catch (err) {
    if (err.statusCode === 401) {
      recordAuditLog({ action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED, userEmail: req.validatedBody.email, description: `Failed login attempt for ${req.validatedBody.email}`, ipAddress: getClientIp(req) });
      return res.status(401).render("admin/login", {
        layout: false,
        title: "Sign In",
        error: err.message,
        csrfToken: res.locals.csrfToken,
        siteName: env.SITE_NAME,
        mode: "login",
      });
    }
    next(err);
  }
});

router.post("/logout", (req, res) => {
  const token = req.cookies?.[COOKIE_NAMES.AUTH_TOKEN];
  if (token) {
    clearAuthCache(token);
  }
  logger.info("User logged out", { requestId: req.requestId, userId: req.user?.id });
  recordAuditLog({ action: AUDIT_ACTIONS.AUTH_LOGOUT, userId: req.user?.id, userEmail: req.user?.email, description: `User logged out`, ipAddress: getClientIp(req) });
  res.clearCookie(COOKIE_NAMES.AUTH_TOKEN, { path: "/" });
  res.redirect("/auth/login");
});

export default router;
