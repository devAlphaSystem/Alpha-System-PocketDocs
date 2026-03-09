import { isIpAllowed } from "../modules/settings/ip-restriction-service.js";

export function ipRestrictionMiddleware(req, res, next) {
  const clientIp = req.ip;

  if (!isIpAllowed(clientIp)) {
    return res.status(403).render("error", {
      layout: false,
      statusCode: 403,
      message: "Your IP address is not allowed to access this page.",
    });
  }

  next();
}
