import { pbAuthRefresh, pbGetOne } from "../lib/pocketbase.js";
import { COOKIE_NAMES, COLLECTIONS, ROLES } from "../config/constants.js";
import { AuthenticationError, AuthorizationError } from "../errors/taxonomy.js";
import { logger } from "../lib/logger.js";

const AUTH_CACHE_TTL = 120_000;
const authCache = new Map();

export function clearAuthCache(token) {
  if (token) {
    authCache.delete(token);
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) {
    return next(new AuthenticationError());
  }
  next();
}

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

export function requireProjectAccess(...allowedRoles) {
  return async (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError());
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const projectId = req.params.projectId || req.body?.project;
    if (!projectId) {
      return next(new AuthorizationError());
    }

    try {
      const membership = await findMembership(req.user.id, projectId);
      if (!membership) {
        return next(new AuthorizationError());
      }
      if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
        return next(new AuthorizationError());
      }
      req.projectMembership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function findMembership(userId, projectId) {
  const { pbList } = await import("../lib/pocketbase.js");
  const result = await pbList(COLLECTIONS.PROJECT_MEMBERS, {
    filter: `user = "${userId}" && project = "${projectId}"`,
    perPage: 1,
  });
  return result.items && result.items.length > 0 ? result.items[0] : null;
}

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
      role: refreshResult.record.role || ROLES.VIEWER,
      verified: refreshResult.record.verified,
    };

    authCache.set(token, { user, pbToken: refreshResult.token, expiry: Date.now() + AUTH_CACHE_TTL });

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
