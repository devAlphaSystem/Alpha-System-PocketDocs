import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Express middleware that assigns or validates a UUID request ID from the
 * `x-request-id` header, attaching it to `req.requestId`.
 *
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} _res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {void}
 */
export function requestIdMiddleware(req, _res, next) {
  const incoming = req.headers["x-request-id"];
  req.requestId = typeof incoming === "string" && UUID_RE.test(incoming) ? incoming : randomUUID();
  next();
}

/**
 * Express middleware that logs HTTP request metadata including method, URL,
 * status code, and duration on response finish.
 *
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {void}
 */
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
