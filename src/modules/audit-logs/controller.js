/**
 * @module audit-logs/controller
 * @description Express routes for viewing audit logs in the admin panel.
 * Accessible only to owners and admins.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { listAuditLogs } from "./service.js";
import { ROLES } from "../../config/constants.js";

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.OWNER));

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = req.query.search || "";

    const result = await listAuditLogs({ page, perPage: 50, search: search || undefined });

    res.render("admin/audit-logs/index", {
      title: "Audit Logs",
      headerSubtitle: `${result.totalItems} log entr${result.totalItems !== 1 ? "ies" : "y"}`,
      headerSearch: {
        action: "/admin/audit-logs",
        placeholder: "Search logs...",
        value: search,
      },
      logs: result.items || [],
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      },
      user: req.user,
      search,
      error: req.query.error || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
