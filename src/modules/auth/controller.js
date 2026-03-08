import { Router } from "express";
import { loginUser, registerUser } from "./service.js";
import { loginSchema, registerSchema } from "./validation.js";
import { validate } from "../../middleware/validate.js";
import { COOKIE_NAMES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { clearAuthCache } from "../../middleware/auth.js";

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

router.get("/register", csrfMiddleware, (req, res) => {
  if (req.user) {
    return res.redirect("/admin");
  }
  res.render("admin/login", {
    layout: false,
    title: "Create Account",
    error: null,
    csrfToken: res.locals.csrfToken,
    siteName: env.SITE_NAME,
    mode: "register",
  });
});

router.post("/login", csrfMiddleware, validate(loginSchema), async (req, res, next) => {
  try {
    const { token, user } = await loginUser(req.validatedBody.email, req.validatedBody.password, req.requestId);
    res.cookie(COOKIE_NAMES.AUTH_TOKEN, token, cookieOptions);
    res.redirect("/admin");
  } catch (err) {
    if (err.statusCode === 401) {
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

router.post("/register", csrfMiddleware, validate(registerSchema), async (req, res, next) => {
  try {
    const { token, user } = await registerUser(req.validatedBody, req.requestId);
    res.cookie(COOKIE_NAMES.AUTH_TOKEN, token, cookieOptions);
    res.redirect("/admin");
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      return res.status(err.statusCode).render("admin/login", {
        layout: false,
        title: "Create Account",
        error: err.message,
        csrfToken: res.locals.csrfToken,
        siteName: env.SITE_NAME,
        mode: "register",
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
  res.clearCookie(COOKIE_NAMES.AUTH_TOKEN, { path: "/" });
  res.redirect("/auth/login");
});

export default router;
