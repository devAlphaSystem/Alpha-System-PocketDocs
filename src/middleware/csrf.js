import { randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { COOKIE_NAMES } from "../config/constants.js";
import { env } from "../config/env.js";
import { CsrfError } from "../errors/taxonomy.js";
import { logger } from "../lib/logger.js";

function generateToken() {
  return randomBytes(32).toString("hex");
}

function signToken(token) {
  return createHmac("sha256", env.CSRF_SECRET).update(token).digest("hex");
}

export function csrfMiddleware(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    let token = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
    if (!token) {
      token = generateToken();
      res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });
    }
    res.locals.csrfToken = signToken(token);
    return next();
  }

  const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF_TOKEN];
  const formToken = req.body?._csrf || req.headers["x-csrf-token"];

  if (!cookieToken || !formToken) {
    logger.warn("CSRF validation failed", { requestId: req.requestId, reason: "missing_token", path: req.originalUrl });
    return next(new CsrfError());
  }

  const expected = signToken(cookieToken);

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(formToken, "hex");

    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
      logger.warn("CSRF validation failed", { requestId: req.requestId, reason: "token_mismatch", path: req.originalUrl });
      return next(new CsrfError());
    }
  } catch (_err) {
    logger.warn("CSRF validation failed", { requestId: req.requestId, reason: "invalid_format", path: req.originalUrl });
    return next(new CsrfError());
  }

  res.locals.csrfToken = expected;
  next();
}
