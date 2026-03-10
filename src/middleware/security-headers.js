import { env } from "../config/env.js";

const CSP_VALUE = ["default-src 'self'", "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net 'unsafe-inline'", "style-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline'", "font-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://fonts.gstatic.com", "img-src 'self' data: blob:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");

const STATIC_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": CSP_VALUE,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-XSS-Protection": "0",
};

if (env.NODE_ENV === "production") {
  STATIC_HEADERS["Cache-Control"] = "no-store";
}

const headerEntries = Object.entries(STATIC_HEADERS);

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
  for (let i = 0; i < headerEntries.length; i++) {
    res.setHeader(headerEntries[i][0], headerEntries[i][1]);
  }
  next();
}
