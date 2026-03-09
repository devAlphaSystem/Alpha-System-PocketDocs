import { env } from "../config/env.js";

/**
 * Express middleware that sets security-related HTTP headers including HSTS,
 * CSP, X-Frame-Options, Referrer-Policy, and Permissions-Policy.
 *
 * @param {import("express").Request} _req - The Express request object.
 * @param {import("express").Response} res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {void}
 */
export function securityHeadersMiddleware(_req, res, next) {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", ["default-src 'self'", "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline'", "style-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline'", "font-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://fonts.gstatic.com", "img-src 'self' data: blob:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-XSS-Protection", "0");

  if (env.NODE_ENV === "production") {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}
