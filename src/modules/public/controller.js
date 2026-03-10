/**
 * @module public/controller
 * @description Express routes for the public-facing documentation site, including
 * project listings, versioned docs, changelogs, and search.
 */
import { Router } from "express";
import { listPublicProjects, getPublicProject, getPublicVersions, getPublicVersionByProjectSlug, getPublicPages, getPublicPage, getPublicChangelog, searchPages } from "./service.js";
import { buildPageTree } from "../pages/service.js";
import { renderMarkdown, extractHeadings } from "../../lib/markdown.js";
import { NotFoundError } from "../../errors/taxonomy.js";
import { ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { createHash } from "node:crypto";

const router = Router();

function isAdminUser(req) {
  return req.user?.role === ROLES.OWNER || req.user?.role === ROLES.ADMIN;
}

router.get("/", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const result = await listPublicProjects(admin);
    res.render("public/home", {
      title: env.SITE_NAME,
      projects: result.items || [],
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const project = await getPublicProject(req.params.projectSlug, admin);
    const versionsResult = await getPublicVersions(project.id, admin);
    const versions = versionsResult.items || [];
    const defaultVersion = versions.length > 0 ? versions[0] : null;

    if (!defaultVersion) {
      return res.render("public/project", {
        title: project.name,
        project,
        versions,
        defaultVersion: null,
        siteName: env.SITE_NAME,
        siteUrl: env.SITE_URL,
        user: req.user || null,
      });
    }

    res.redirect(`/docs/${project.slug}/${defaultVersion.slug}`);
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const version = await getPublicVersionByProjectSlug(req.params.projectSlug, req.params.versionSlug, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    const project = version.expand?.project;
    if (!project) {
      throw new NotFoundError("Project");
    }

    const pagesResult = await getPublicPages(version.id);

    const pages = pagesResult.items || [];
    const pageTree = buildPageTree(pages);

    if (pages.length > 0) {
      const firstPage = pageTree[0] || pages[0];
      return res.redirect(`/docs/${project.slug}/${version.slug}/${firstPage.slug}`);
    }

    return res.redirect(`/docs/${project.slug}/${version.slug}/changelog`);
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug/changelog", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const version = await getPublicVersionByProjectSlug(req.params.projectSlug, req.params.versionSlug, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    const project = version.expand?.project;
    if (!project) {
      throw new NotFoundError("Project");
    }

    const [versionsResult, pagesResult, changelog] = await Promise.all([getPublicVersions(project.id, admin), getPublicPages(version.id), getPublicChangelog(version.id)]);

    const contentHtml = changelog ? renderMarkdown(changelog.content) : "";
    const pageTree = buildPageTree(pagesResult.items || []);

    res.render("public/changelog", {
      title: `Changelog - ${version.label} - ${project.name}`,
      project,
      version,
      versions: versionsResult.items || [],
      pageTree,
      changelog,
      contentHtml,
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug/:pageSlug", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const version = await getPublicVersionByProjectSlug(req.params.projectSlug, req.params.versionSlug, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    const project = version.expand?.project;
    if (!project) {
      throw new NotFoundError("Project");
    }

    const [versionsResult, pagesResult, page] = await Promise.all([getPublicVersions(project.id, admin), getPublicPages(version.id), getPublicPage(version.id, req.params.pageSlug)]);

    if (!page) {
      throw new NotFoundError("Page");
    }

    const pages = pagesResult.items || [];
    const pageTree = buildPageTree(pages);
    const contentHtml = renderMarkdown(page.content);
    const headings = extractHeadings(contentHtml);

    const etagSource = `${page.id}:${page.updated}`;
    const etag = `"${createHash("md5").update(etagSource).digest("hex")}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    const pageIndex = pages.findIndex((p) => p.id === page.id);
    const prevPage = pageIndex > 0 ? pages[pageIndex - 1] : null;
    const nextPage = pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null;

    res.render("public/docs", {
      title: `${page.title} - ${project.name}`,
      project,
      version,
      versions: versionsResult.items || [],
      page,
      pages,
      pageTree,
      contentHtml,
      headings,
      prevPage,
      nextPage,
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/api/search", async (req, res, next) => {
  try {
    const { q, project: projectSlug, version: versionId } = req.query;
    if (!q || !projectSlug) {
      return res.json({ results: [] });
    }

    const admin = isAdminUser(req);
    const project = await getPublicProject(projectSlug, admin);
    const results = await searchPages(project.id, q, versionId, admin);

    res.json({
      results: results.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        versionLabel: p.expand?.version?.label || "",
        versionSlug: p.expand?.version?.slug || "",
      })),
    });
  } catch (err) {
    logger.warn("Search query failed", { requestId: req.requestId, query: q, error: err.message });
    res.json({ results: [] });
  }
});

export default router;
