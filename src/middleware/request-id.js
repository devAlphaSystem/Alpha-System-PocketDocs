import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

export function requestIdMiddleware(req, _res, next) {
  req.requestId = req.headers["x-request-id"] || randomUUID();
  next();
}

export function requestLoggerMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http("HTTP request", {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      userAgent: req.headers["user-agent"],
      contentLength: res.getHeader("content-length"),
    });
  });

  next();
}
