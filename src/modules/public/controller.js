/**
 * @module public/controller
 * @description Express routes for the public-facing documentation site, including
 * project listings, versioned docs, content sections, changelogs, and search.
 */
import { Router } from "express";
import { listPublicProjects, getPublicProject, getPublicVersions, getPublicVersionByProjectSlug, getPublicPages, getPublicPage, getPublicChangelog, getPublicSectionPages, getPublicSectionPage, searchPages, getSingleProjectVersion, getSingleProjectPage } from "./service.js";
import { buildPageTree, flattenPageTree, getPageSectionLabel, isKnowledgeBaseSection, PAGE_SECTION_OPTIONS } from "../pages/service.js";
import { renderMarkdown, extractHeadings } from "../../lib/markdown.js";
import { NotFoundError } from "../../errors/taxonomy.js";
import { ROLES, PROJECT_MODE, PAGE_SECTIONS } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { createHash } from "node:crypto";

const router = Router();
const ARTICLE_SECTION_OPTIONS = PAGE_SECTION_OPTIONS.filter((option) => option.value !== PAGE_SECTIONS.DOCUMENTS);

function isAdminUser(req) {
  return req.user?.role === ROLES.OWNER || req.user?.role === ROLES.ADMIN;
}

function projectMode(project) {
  return project?.mode || PROJECT_MODE.VERSIONED;
}

function isVersioned(project) {
  return projectMode(project) === PROJECT_MODE.VERSIONED;
}

function isNonVersioned(project) {
  return projectMode(project) === PROJECT_MODE.NON_VERSIONED;
}

function assertVersioned(project, resource) {
  if (!isVersioned(project)) {
    throw new NotFoundError(resource);
  }
}

function knowledgeBaseBaseUrl(project, version) {
  if (isNonVersioned(project)) {
    return `/docs/${project.slug}/_kb`;
  }
  return `/docs/${project.slug}/${version.slug}/_kb`;
}

function docsPageHref(project, version, page) {
  if (isNonVersioned(project)) {
    return `/docs/${project.slug}/${page.slug}`;
  }
  return `/docs/${project.slug}/${version.slug}/${page.slug}`;
}

function knowledgeBasePageHref(project, version, page) {
  return `${knowledgeBaseBaseUrl(project, version)}/${page.section}/${page.slug}`;
}

function groupKnowledgeBasePages(pages) {
  return ARTICLE_SECTION_OPTIONS.map((option) => {
    const sectionPages = pages.filter((page) => page.section === option.value);
    return {
      ...option,
      pages: sectionPages,
      pageTree: buildPageTree(sectionPages),
    };
  });
}

function countKnowledgeBaseSections(pages) {
  const counts = Object.fromEntries(ARTICLE_SECTION_OPTIONS.map((option) => [option.value, 0]));
  for (const page of pages || []) {
    if (Object.prototype.hasOwnProperty.call(counts, page.section)) {
      counts[page.section] += 1;
    }
  }
  return counts;
}

function firstArticleSection(pages) {
  if ((pages || []).some((page) => page.section === PAGE_SECTIONS.FAQ)) {
    return PAGE_SECTIONS.FAQ;
  }
  if ((pages || []).some((page) => page.section === PAGE_SECTIONS.TROUBLESHOOTING)) {
    return PAGE_SECTIONS.TROUBLESHOOTING;
  }
  return "";
}

async function renderKnowledgeBase(req, res, next, { project, version, versions = [], section = "", pageSlug = "" }) {
  try {
    if (section) {
      if (!isKnowledgeBaseSection(section)) {
        throw new NotFoundError("Content section");
      }
    }

    const [pagesResult, knowledgeBaseResult, allKnowledgeBaseResult] = await Promise.all([getPublicPages(version.id), getPublicSectionPages(version.id, section), section ? getPublicSectionPages(version.id) : Promise.resolve(null)]);
    const docsPages = pagesResult.items || [];
    const knowledgeBasePages = knowledgeBaseResult.items || [];
    const allKnowledgeBasePages = allKnowledgeBaseResult?.items || knowledgeBasePages;
    const knowledgeBaseSectionCounts = countKnowledgeBaseSections(allKnowledgeBasePages);
    const pageTree = buildPageTree(docsPages);
    const kbPageTree = buildPageTree(knowledgeBasePages);
    const selectedSection = section || "";
    const sectionLabel = selectedSection ? getPageSectionLabel(selectedSection) : "Knowledge Base";

    let knowledgeBasePage = null;
    let contentHtml = "";
    let headings = [];

    if (pageSlug) {
      knowledgeBasePage = await getPublicSectionPage(version.id, selectedSection, pageSlug);
      if (!knowledgeBasePage) {
        throw new NotFoundError("Article");
      }

      contentHtml = renderMarkdown(knowledgeBasePage.content);
      headings = extractHeadings(contentHtml);

      const etagSource = `${knowledgeBasePage.id}:${knowledgeBasePage.updated}`;
      const etag = `"${createHash("md5").update(etagSource).digest("hex")}"`;
      res.setHeader("ETag", etag);
      if (req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }
    }

    res.render("public/knowledge-base", {
      title: knowledgeBasePage ? `${knowledgeBasePage.title} - ${project.name}` : `${sectionLabel} - ${project.name}`,
      project,
      version,
      versions,
      pageTree,
      page: null,
      nonVersionedMode: isNonVersioned(project),
      supportsKnowledgeBase: true,
      kbBaseUrl: knowledgeBaseBaseUrl(project, version),
      knowledgeBaseSectionCounts,
      section: selectedSection,
      sectionLabel,
      sectionOptions: ARTICLE_SECTION_OPTIONS,
      sectionGroups: selectedSection ? [] : groupKnowledgeBasePages(knowledgeBasePages),
      kbPages: knowledgeBasePages,
      kbPageTree,
      kbPageItems: flattenPageTree(kbPageTree),
      kbPage: knowledgeBasePage,
      contentHtml,
      headings,
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
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

    if (isNonVersioned(project)) {
      const version = await getSingleProjectVersion(project.id, admin);
      if (!version) {
        return res.render("public/project", {
          title: project.name,
          project,
          versions: [],
          defaultVersion: null,
          siteName: env.SITE_NAME,
          siteUrl: env.SITE_URL,
          user: req.user || null,
        });
      }
      const pagesResult = await getPublicPages(version.id);
      const pages = pagesResult.items || [];
      const pageTree = buildPageTree(pages);
      const firstPage = pageTree[0] || pages[0];
      if (firstPage) {
        return res.redirect(`/docs/${project.slug}/${firstPage.slug}`);
      }

      const sectionPagesResult = await getPublicSectionPages(version.id);
      const sectionPages = sectionPagesResult.items || [];
      const firstSection = firstArticleSection(sectionPages);
      if (firstSection) {
        return res.redirect(`/docs/${project.slug}/_kb/${firstSection}`);
      }

      return res.render("public/project", {
        title: project.name,
        project,
        versions: [],
        defaultVersion: null,
        siteName: env.SITE_NAME,
        siteUrl: env.SITE_URL,
        user: req.user || null,
      });
    }

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

router.get("/docs/:projectSlug/_kb", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const project = await getPublicProject(req.params.projectSlug, admin);
    if (!isNonVersioned(project)) {
      throw new NotFoundError("Knowledge Base");
    }
    const version = await getSingleProjectVersion(project.id, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    const sectionPagesResult = await getPublicSectionPages(version.id);
    const section = firstArticleSection(sectionPagesResult.items || []) || PAGE_SECTIONS.FAQ;
    return res.redirect(`/docs/${project.slug}/_kb/${section}`);
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/_kb/:section", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const project = await getPublicProject(req.params.projectSlug, admin);
    if (!isNonVersioned(project)) {
      throw new NotFoundError("Knowledge Base");
    }
    const version = await getSingleProjectVersion(project.id, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    return renderKnowledgeBase(req, res, next, { project, version, section: req.params.section });
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/_kb/:section/:pageSlug", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const project = await getPublicProject(req.params.projectSlug, admin);
    if (!isNonVersioned(project)) {
      throw new NotFoundError("Knowledge Base");
    }
    const version = await getSingleProjectVersion(project.id, admin);
    if (!version) {
      throw new NotFoundError("Version");
    }
    return renderKnowledgeBase(req, res, next, { project, version, section: req.params.section, pageSlug: req.params.pageSlug });
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:segment", async (req, res, next) => {
  try {
    const admin = isAdminUser(req);
    const project = await getPublicProject(req.params.projectSlug, admin);

    if (!isNonVersioned(project)) {
      return next("route");
    }

    const version = await getSingleProjectVersion(project.id, admin);
    if (!version) {
      throw new NotFoundError("Page");
    }

    const [pagesResult, page] = await Promise.all([getPublicPages(version.id), getSingleProjectPage(req.params.segment, version.id)]);

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
      versions: [],
      page,
      pages,
      pageTree,
      contentHtml,
      headings,
      prevPage,
      nextPage,
      nonVersionedMode: true,
      supportsKnowledgeBase: true,
      kbBaseUrl: knowledgeBaseBaseUrl(project, version),
      knowledgeBaseSectionCounts: countKnowledgeBaseSections((await getPublicSectionPages(version.id)).items || []),
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
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
    assertVersioned(project, "Version");

    const [pagesResult, sectionPagesResult] = await Promise.all([getPublicPages(version.id), getPublicSectionPages(version.id)]);

    const pages = pagesResult.items || [];
    const pageTree = buildPageTree(pages);
    const sectionPages = sectionPagesResult.items || [];

    if (pages.length > 0) {
      const firstPage = pageTree[0] || pages[0];
      return res.redirect(`/docs/${project.slug}/${version.slug}/${firstPage.slug}`);
    }

    const firstSection = firstArticleSection(sectionPages);
    if (firstSection) {
      return res.redirect(`/docs/${project.slug}/${version.slug}/_kb/${firstSection}`);
    }

    return res.redirect(`/docs/${project.slug}/${version.slug}/changelog`);
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug/_kb", async (req, res, next) => {
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
    assertVersioned(project, "Knowledge Base");

    const sectionPagesResult = await getPublicSectionPages(version.id);
    const section = firstArticleSection(sectionPagesResult.items || []) || PAGE_SECTIONS.FAQ;
    return res.redirect(`/docs/${project.slug}/${version.slug}/_kb/${section}`);
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug/_kb/:section", async (req, res, next) => {
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
    assertVersioned(project, "Knowledge Base");

    const versionsResult = await getPublicVersions(project.id, admin);
    return renderKnowledgeBase(req, res, next, { project, version, versions: versionsResult.items || [], section: req.params.section });
  } catch (err) {
    next(err);
  }
});

router.get("/docs/:projectSlug/:versionSlug/_kb/:section/:pageSlug", async (req, res, next) => {
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
    assertVersioned(project, "Knowledge Base");

    const versionsResult = await getPublicVersions(project.id, admin);
    return renderKnowledgeBase(req, res, next, { project, version, versions: versionsResult.items || [], section: req.params.section, pageSlug: req.params.pageSlug });
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
    assertVersioned(project, "Changelog");

    const [versionsResult, pagesResult, changelog, knowledgeBaseResult] = await Promise.all([getPublicVersions(project.id, admin), getPublicPages(version.id), getPublicChangelog(version.id), getPublicSectionPages(version.id)]);

    const contentHtml = changelog ? renderMarkdown(changelog.content) : "";
    const pageTree = buildPageTree(pagesResult.items || []);
    const knowledgeBaseSectionCounts = countKnowledgeBaseSections(knowledgeBaseResult.items || []);

    res.render("public/changelog", {
      title: `Changelog - ${version.label} - ${project.name}`,
      project,
      version,
      versions: versionsResult.items || [],
      pageTree,
      nonVersionedMode: false,
      supportsKnowledgeBase: true,
      kbBaseUrl: knowledgeBaseBaseUrl(project, version),
      knowledgeBaseSectionCounts,
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
    assertVersioned(project, "Page");

    const [versionsResult, pagesResult, page, knowledgeBaseResult] = await Promise.all([getPublicVersions(project.id, admin), getPublicPages(version.id), getPublicPage(version.id, req.params.pageSlug), getPublicSectionPages(version.id)]);

    if (!page) {
      throw new NotFoundError("Page");
    }

    const pages = pagesResult.items || [];
    const pageTree = buildPageTree(pages);
    const knowledgeBaseSectionCounts = countKnowledgeBaseSections(knowledgeBaseResult.items || []);
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
      nonVersionedMode: false,
      supportsKnowledgeBase: true,
      kbBaseUrl: knowledgeBaseBaseUrl(project, version),
      knowledgeBaseSectionCounts,
      siteName: env.SITE_NAME,
      siteUrl: env.SITE_URL,
      user: req.user || null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/api/search", async (req, res) => {
  try {
    const { q, project: projectSlug, version: versionId } = req.query;
    if (!q || !projectSlug) {
      return res.json({ results: [] });
    }

    const admin = isAdminUser(req);
    const project = await getPublicProject(projectSlug, admin);
    const pageResults = await searchPages(project.id, q, versionId, admin);
    const results = pageResults.map((p) => {
      const version = p.expand?.version || {};
      const section = p.section || PAGE_SECTIONS.DOCUMENTS;
      if (section === PAGE_SECTIONS.DOCUMENTS) {
        return {
          id: p.id,
          type: "page",
          title: p.title,
          slug: p.slug,
          versionLabel: version.label || "",
          versionSlug: version.slug || "",
          simpleMode: isNonVersioned(project),
          href: docsPageHref(project, version, p),
        };
      }
      return {
        id: p.id,
        type: "article",
        title: p.title,
        slug: p.slug,
        section,
        sectionLabel: getPageSectionLabel(section),
        versionLabel: version.label || "",
        versionSlug: version.slug || "",
        simpleMode: false,
        href: knowledgeBasePageHref(project, version, p),
      };
    });

    res.json({ results: results.slice(0, 20) });
  } catch (err) {
    logger.warn("Search query failed", { requestId: req.requestId, query: req.query.q, error: err.message });
    res.json({ results: [] });
  }
});

export default router;
