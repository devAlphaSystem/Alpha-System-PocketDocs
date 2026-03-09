import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(req, _res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId = typeof incoming === "string" && UUID_RE.test(incoming) ? incoming : randomUUID();
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
