import { pbAuthRefresh } from "../lib/pocketbase.js";
import { COOKIE_NAMES, ROLES } from "../config/constants.js";
import { AuthenticationError, AuthorizationError } from "../errors/taxonomy.js";
import { logger } from "../lib/logger.js";

const AUTH_CACHE_TTL = 120_000;
const AUTH_CACHE_MAX_SIZE = 10_000;
const authCache = new Map();

function evictStaleEntries() {
  const now = Date.now();
  for (const [key, value] of authCache) {
    if (now >= value.expiry) {
      authCache.delete(key);
    }
  }
}

setInterval(evictStaleEntries, 60_000).unref();

/**
 * Removes a cached authentication entry for the given token.
 *
 * @param {string} [token] - The auth token to evict from cache.
 * @returns {void}
 */
export function clearAuthCache(token) {
  if (token) {
    authCache.delete(token);
  }
}

/**
 * Express middleware that rejects unauthenticated requests with a 401 error.
 *
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} _res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {void}
 */
export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AuthenticationError());
  }
  next();
}

/**
 * Creates middleware that restricts access to users with one of the specified roles.
 *
 * @param {...string} allowedRoles - The role strings permitted to access the route.
 * @returns {import("express").RequestHandler} Express middleware function.
 */
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError());
    }
    next();
  };
}

/**
 * Creates middleware that grants access to owners and admins unconditionally,
 * and optionally restricts other roles to the specified list.
 *
 * @param {...string} allowedRoles - Additional roles permitted beyond owner and admin.
 * @returns {import("express").RequestHandler} Express middleware function.
 */
export function requireProjectAccess(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (req.user.role === ROLES.OWNER || req.user.role === ROLES.ADMIN) {
      return next();
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return next(new AuthorizationError());
    }

    next();
  };
}

/**
 * Express middleware that loads and caches the authenticated user from the
 * auth cookie, attaching `req.user` and `req.pbToken` when valid.
 *
 * @param {import("express").Request} req - The Express request object.
 * @param {import("express").Response} _res - The Express response object.
 * @param {import("express").NextFunction} next - The next middleware function.
 * @returns {Promise<void>}
 */
export async function loadUserMiddleware(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAMES.AUTH_TOKEN];
  if (!token) {
    req.user = null;
    return next();
  }

  const cached = authCache.get(token);
  if (cached && Date.now() < cached.expiry) {
    req.user = cached.user;
    req.pbToken = cached.pbToken;
    return next();
  }

  try {
    const refreshResult = await pbAuthRefresh(token);
    if (!refreshResult) {
      authCache.delete(token);
      req.user = null;
      return next();
    }

    const user = {
      id: refreshResult.record.id,
      email: refreshResult.record.email,
      name: refreshResult.record.name,
      role: refreshResult.record.role || ROLES.EDITOR,
      verified: refreshResult.record.verified,
    };

    authCache.set(token, { user, pbToken: refreshResult.token, expiry: Date.now() + AUTH_CACHE_TTL });

    if (authCache.size > AUTH_CACHE_MAX_SIZE) {
      evictStaleEntries();
    }

    req.user = user;
    req.pbToken = refreshResult.token;
    next();
  } catch (err) {
    logger.warn("Token validation failed", {
      requestId: req.requestId,
      error: err.message,
    });
    authCache.delete(token);
    req.user = null;
    next();
  }
}
