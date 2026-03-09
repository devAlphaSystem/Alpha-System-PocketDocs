/**
 * @module users/controller
 * @description Express routes for owner-level user management, including
 * creating, updating, and deleting user accounts.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { validate } from "../../middleware/validate.js";
import { listUsers, getUser, createUser, updateUser, deleteUser } from "./service.js";
import { createUserSchema, updateUserSchema } from "./validation.js";
import { ROLES } from "../../config/constants.js";

const router = Router();

router.use(requireAuth, requireRole(ROLES.OWNER), csrfMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const result = await listUsers(page);
    res.render("admin/users/index", {
      title: "Users",
      headerSubtitle: `${result.totalItems} user${result.totalItems !== 1 ? "s" : ""}`,
      users: result.items || [],
      pagination: { page: result.page, totalPages: result.totalPages, totalItems: result.totalItems },
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: req.query.error || null,
      success: req.query.success || null,
      editUser: null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/edit", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [result, editUser] = await Promise.all([listUsers(page), getUser(req.params.id)]);
    res.render("admin/users/index", {
      title: "Users",
      headerSubtitle: `${result.totalItems} user${result.totalItems !== 1 ? "s" : ""}`,
      users: result.items || [],
      pagination: { page: result.page, totalPages: result.totalPages, totalItems: result.totalItems },
      user: req.user,
      csrfToken: res.locals.csrfToken,
      error: req.query.error || null,
      success: null,
      editUser,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/create", validate(createUserSchema), async (req, res, next) => {
  try {
    await createUser(req.validatedBody, req.requestId);
    res.redirect("/admin/users?success=User created successfully.");
  } catch (err) {
    if (err.statusCode === 409 || err.statusCode === 422) {
      return res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
    }
    next(err);
  }
});

router.post("/:id/update", validate(updateUserSchema), async (req, res, next) => {
  try {
    await updateUser(req.params.id, req.validatedBody, req.user.id, req.requestId);
    res.redirect("/admin/users?success=User updated successfully.");
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 409 || err.statusCode === 422) {
      return res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
    }
    next(err);
  }
});

router.post("/:id/delete", async (req, res, next) => {
  try {
    await deleteUser(req.params.id, req.user.id, req.requestId);
    res.redirect("/admin/users?success=User deleted successfully.");
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 422) {
      return res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
    }
    next(err);
  }
});

export default router;
