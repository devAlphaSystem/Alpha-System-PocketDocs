import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import expressLayouts from "express-ejs-layouts";

import { env, trustProxy } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { authenticateAdmin } from "./lib/pocketbase.js";
import { getClientIp } from "./lib/request-ip.js";
import { requestIdMiddleware, requestLoggerMiddleware } from "./middleware/request-id.js";
import { securityHeadersMiddleware } from "./middleware/security-headers.js";
import { loadUserMiddleware } from "./middleware/auth.js";
import { errorHandlerMiddleware, notFoundMiddleware } from "./middleware/error-handler.js";

import authRoutes from "./modules/auth/controller.js";
import setupRoutes from "./modules/setup/controller.js";
import projectRoutes from "./modules/projects/controller.js";
import versionRoutes from "./modules/versions/controller.js";
import pageRoutes from "./modules/pages/controller.js";
import changelogRoutes from "./modules/changelogs/controller.js";
import settingsRoutes from "./modules/settings/controller.js";
import userRoutes from "./modules/users/controller.js";
import publicRoutes from "./modules/public/controller.js";
import githubRoutes from "./modules/github/controller.js";
import { loadSettings, getSettings } from "./modules/settings/service.js";
import { loadIpRestriction, isIpAllowed } from "./modules/settings/ip-restriction-service.js";
import { ipRestrictionMiddleware } from "./middleware/ip-restriction.js";
import { checkOwnerExists, isOwnerSetupComplete } from "./modules/setup/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", join(__dirname, "../views"));
app.set("x-powered-by", false);
app.set("trust proxy", trustProxy);

app.use(expressLayouts);
app.set("layout", "layouts/public");

app.use(compression());
app.use(
  express.static(join(__dirname, "../public"), {
    maxAge: env.NODE_ENV === "production" ? "7d" : 0,
    etag: true,
  }),
);
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(securityHeadersMiddleware);

app.get("/health", async (_req, res) => {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  try {
    await authenticateAdmin();
    res.json({
      status: "healthy",
      uptime_s: Math.floor(uptime),
      memory: {
        rss_mb: Math.round(mem.rss / 1048576),
        heap_used_mb: Math.round(mem.heapUsed / 1048576),
        heap_total_mb: Math.round(mem.heapTotal / 1048576),
      },
    });
  } catch (_err) {
    res.status(503).json({
      status: "unhealthy",
      uptime_s: Math.floor(uptime),
      checks: { pocketbase: "unreachable" },
    });
  }
});

const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", { requestId: req.requestId, ip: getClientIp(req), path: req.originalUrl });
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } });
  },
});

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Auth rate limit exceeded", { requestId: req.requestId, ip: getClientIp(req), path: req.originalUrl });
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." } });
  },
});

app.use(loadUserMiddleware);
app.use(generalLimiter);

const setupRedirectMiddleware = (req, res, next) => {
  if (!isOwnerSetupComplete() && !req.path.startsWith("/setup") && !req.path.startsWith("/css") && !req.path.startsWith("/js") && !req.path.startsWith("/img") && req.path !== "/favicon.ico") {
    return res.redirect("/setup");
  }
  next();
};

app.use(setupRedirectMiddleware);

app.use((req, res, next) => {
  res.locals.siteName = env.SITE_NAME;
  res.locals.siteUrl = env.SITE_URL;
  res.locals.sitePbUrl = env.POCKETBASE_URL;
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.siteSettings = getSettings();
  res.locals.ipAllowed = isIpAllowed(getClientIp(req));
  next();
});

app.use(
  "/setup",
  (req, res, next) => {
    res.locals.layout = false;
    next();
  },
  authLimiter,
  setupRoutes,
);

app.use(
  "/auth",
  ipRestrictionMiddleware,
  (req, res, next) => {
    res.locals.layout = false;
    next();
  },
  authLimiter,
  authRoutes,
);

app.get("/admin/login", ipRestrictionMiddleware, (_req, res) => res.redirect(301, "/auth/login"));

app.get("/admin", ipRestrictionMiddleware, (req, res) => {
  if (!req.user) {
    return res.redirect("/auth/login");
  }
  res.redirect("/admin/projects");
});

const adminLayoutMiddleware = (req, res, next) => {
  res.locals.layout = "layouts/admin";
  next();
};

app.use("/admin/github", ipRestrictionMiddleware, adminLayoutMiddleware, githubRoutes);
app.use("/admin/settings", ipRestrictionMiddleware, adminLayoutMiddleware, settingsRoutes);
app.use("/admin/users", ipRestrictionMiddleware, adminLayoutMiddleware, userRoutes);
app.use("/admin/projects", ipRestrictionMiddleware, adminLayoutMiddleware, projectRoutes);
app.use("/admin/projects/:projectId/versions", ipRestrictionMiddleware, adminLayoutMiddleware, versionRoutes);
app.use("/admin/projects/:projectId/versions/:versionId/pages", ipRestrictionMiddleware, adminLayoutMiddleware, pageRoutes);
app.use("/admin/projects/:projectId/versions/:versionId/changelog", ipRestrictionMiddleware, adminLayoutMiddleware, changelogRoutes);

app.use("/", publicRoutes);

app.get("/favicon.ico", (_req, res) => {
  res.sendFile(join(__dirname, "../public/img/logo.png"));
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

async function start() {
  const startTime = Date.now();

  await loadSettings();
  logger.info("Site settings loaded");

  await loadIpRestriction();
  logger.info("IP restriction settings loaded");

  try {
    await authenticateAdmin();
    logger.info("PocketBase admin connection verified");
  } catch (err) {
    logger.error("Failed to connect to PocketBase", {
      error: err.message,
      url: env.POCKETBASE_URL,
    });
    process.exit(1);
  }

  const ownerReady = await checkOwnerExists();
  logger.info(ownerReady ? "Owner account found" : "No owner account — setup required");

  app.listen(env.PORT, env.HOST, function () {
    const server = this;

    function shutdown(signal) {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    logger.info("PocketDocs server started", {
      port: env.PORT,
      host: env.HOST,
      trustProxy: env.TRUST_PROXY,
      environment: env.NODE_ENV,
      url: `http://${env.HOST === "0.0.0.0" ? "localhost" : env.HOST}:${env.PORT}`,
      startup_ms: Date.now() - startTime,
    });
  });
}

start();
