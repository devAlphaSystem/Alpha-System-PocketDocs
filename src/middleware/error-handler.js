import { AppError } from "../errors/app-error.js";
import { buildErrorEnvelope, logError } from "../errors/handler.js";
import { AuthenticationError, NotFoundError } from "../errors/taxonomy.js";
import { env } from "../config/env.js";

/**
 * Global Express error-handling middleware that renders error pages for HTML
 * requests and returns JSON envelopes for API or XHR requests.
 *
 * @param {Error} err - The error to handle.
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} res - The Express response object.
 * @param {import("express").NextFunction} _next - The next middleware function.
 * @returns {void}
 */
export function errorHandlerMiddleware(err, req, res, _next) {
  logError(err, req.requestId, req.originalUrl);

  if (res.headersSent) {
    return;
  }

  const isHtml = req.accepts("html") && !req.xhr && !req.path.startsWith("/api/");

  if (isHtml && err instanceof AuthenticationError) {
    return res.redirect("/auth/login");
  }

  if (err instanceof AppError) {
    const { statusCode, body } = buildErrorEnvelope(err, req.requestId);

    if (req.accepts("html") && !req.xhr && !req.path.startsWith("/api/")) {
      return res.status(statusCode).render("error", {
        layout: false,
        title: "Error",
        statusCode,
        message: body.error.message,
        code: body.error.code,
        requestId: req.requestId,
        user: req.user || null,
        siteName: env.SITE_NAME,
      });
    }

    return res.status(statusCode).json(body);
  }

  const { statusCode, body } = buildErrorEnvelope(err, req.requestId);

  if (req.accepts("html") && !req.xhr && !req.path.startsWith("/api/")) {
    return res.status(statusCode).render("error", {
      layout: false,
      title: "Error",
      statusCode,
      message: "An unexpected error occurred. Please try again later.",
      code: "INTERNAL_ERROR",
      requestId: req.requestId,
      user: req.user || null,
      siteName: env.SITE_NAME,
    });
  }

  res.status(statusCode).json(body);
}

/**
 * Express middleware that converts unmatched routes into a `NotFoundError`.
 *
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} _res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {Promise<void>}
 */
export function notFoundMiddleware(req, _res, next) {
  const err = new NotFoundError("Page");
  err.requestedUrl = `${req.method} ${req.originalUrl}`;
  next(err);
}
