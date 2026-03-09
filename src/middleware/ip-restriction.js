import { isIpAllowed } from "../modules/settings/ip-restriction-service.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { getClientIp, getClientIpDebug } from "../lib/request-ip.js";

export function ipRestrictionMiddleware(req, res, next) {
  const clientIp = getClientIp(req);

  if (!isIpAllowed(clientIp)) {
    logger.warn("IP restricted access blocked", {
      requestId: req.requestId,
      path: req.originalUrl,
      ...getClientIpDebug(req),
    });
    return res.status(403).render("error", {
      layout: false,
      title: "Access Denied",
      statusCode: 403,
      message: "Your IP address is not allowed to access this page.",
      code: "IP_RESTRICTED",
      requestId: req.requestId || "",
      user: req.user || null,
      siteName: env.SITE_NAME,
    });
  }

  next();
}
