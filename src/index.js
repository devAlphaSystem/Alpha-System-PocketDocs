import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import expressLayouts from "express-ejs-layouts";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { authenticateAdmin } from "./lib/pocketbase.js";
import { requestIdMiddleware, requestLoggerMiddleware } from "./middleware/request-id.js";
import { securityHeadersMiddleware } from "./middleware/security-headers.js";
import { loadUserMiddleware } from "./middleware/auth.js";
import { errorHandlerMiddleware, notFoundMiddleware } from "./middleware/error-handler.js";

import authRoutes from "./modules/auth/controller.js";
import projectRoutes from "./modules/projects/controller.js";
import versionRoutes from "./modules/versions/controller.js";
import pageRoutes from "./modules/pages/controller.js";
import changelogRoutes from "./modules/changelogs/controller.js";
import settingsRoutes from "./modules/settings/controller.js";
import publicRoutes from "./modules/public/controller.js";
import { loadSettings, getSettings } from "./modules/settings/service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", join(__dirname, "../views"));
app.set("x-powered-by", false);
app.set("trust proxy", 1);

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

const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
});

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." } },
});

app.use(loadUserMiddleware);
app.use(generalLimiter);

app.use((req, res, next) => {
  res.locals.siteName = env.SITE_NAME;
  res.locals.siteUrl = env.SITE_URL;
  res.locals.sitePbUrl = env.POCKETBASE_URL;
  res.locals.currentUser = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.siteSettings = getSettings();
  next();
});

app.use(
  "/auth",
  (req, res, next) => {
    res.locals.layout = false;
    next();
  },
  authLimiter,
  authRoutes,
);

app.get("/admin/login", (_req, res) => res.redirect(301, "/auth/login"));
app.get("/admin/register", (_req, res) => res.redirect(301, "/auth/register"));

app.get("/admin", (req, res) => {
  if (!req.user) {
    return res.redirect("/auth/login");
  }
  res.redirect("/admin/projects");
});

const adminLayoutMiddleware = (req, res, next) => {
  res.locals.layout = "layouts/admin";
  next();
};

app.use("/admin/settings", adminLayoutMiddleware, settingsRoutes);
app.use("/admin/projects", adminLayoutMiddleware, projectRoutes);
app.use("/admin/projects/:projectId/versions", adminLayoutMiddleware, versionRoutes);
app.use("/admin/projects/:projectId/versions/:versionId/pages", adminLayoutMiddleware, pageRoutes);
app.use("/admin/projects/:projectId/versions/:versionId/changelog", adminLayoutMiddleware, changelogRoutes);

app.use("/", publicRoutes);

app.get("/favicon.ico", (_req, res) => {
  res.sendFile(join(__dirname, "../public/img/logo.png"));
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

async function start() {
  await loadSettings();
  logger.info("Site settings loaded");

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

  app.listen(env.PORT, env.HOST, () => {
    logger.info("PocketDocs server started", {
      port: env.PORT,
      host: env.HOST,
      environment: env.NODE_ENV,
      url: `http://${env.HOST === "0.0.0.0" ? "localhost" : env.HOST}:${env.PORT}`,
    });
  });
}

function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
