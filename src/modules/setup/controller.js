/**
 * @module setup/controller
 * @description Express routes for the initial owner account setup wizard.
 */
import { Router } from "express";
import { registerOwner, isOwnerSetupComplete } from "./service.js";
import { registerSchema } from "../auth/validation.js";
import { validate } from "../../middleware/validate.js";
import { COOKIE_NAMES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { csrfMiddleware } from "../../middleware/csrf.js";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.use((req, res, next) => {
  if (isOwnerSetupComplete()) {
    return res.redirect("/auth/login");
  }
  next();
});

router.get("/", csrfMiddleware, (req, res) => {
  res.render("admin/setup", {
    layout: false,
    title: "Setup",
    error: null,
    csrfToken: res.locals.csrfToken,
    siteName: env.SITE_NAME,
  });
});

router.post("/", csrfMiddleware, validate(registerSchema), async (req, res, next) => {
  try {
    const { token } = await registerOwner(req.validatedBody, req.requestId);
    res.cookie(COOKIE_NAMES.AUTH_TOKEN, token, cookieOptions);
    res.redirect("/admin");
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      return res.status(err.statusCode).render("admin/setup", {
        layout: false,
        title: "Setup",
        error: err.message,
        csrfToken: res.locals.csrfToken,
        siteName: env.SITE_NAME,
      });
    }
    next(err);
  }
});

export default router;
