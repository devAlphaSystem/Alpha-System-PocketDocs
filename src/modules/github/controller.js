/**
 * @module github/controller
 * @description Express routes for GitHub integration, including repository
 * browsing, tag/commit listing, and documentation import.
 */
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { csrfMiddleware } from "../../middleware/csrf.js";
import { ROLES } from "../../config/constants.js";
import { isGitHubConfigured, parseRepoUrl, listUserRepos, getRepoInfo, listTags, listCommits, getDocsTree, importDocsForRef } from "./service.js";
import { createProject } from "../projects/service.js";
import { createProjectSchema } from "../projects/validation.js";
import { createVersion } from "../versions/service.js";
import { createPage } from "../pages/service.js";
import { logger } from "../../lib/logger.js";
import { ValidationError } from "../../errors/taxonomy.js";
import { getClientIp } from "../../lib/request-ip.js";
import { recordAuditLog, AUDIT_ACTIONS } from "../audit-logs/service.js";

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.OWNER));

router.use((req, res, next) => {
  if (!isGitHubConfigured()) {
    return res.status(404).json({ error: { code: "NOT_CONFIGURED", message: "GitHub integration is not configured." } });
  }
  next();
});

router.get("/repos", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const repos = await listUserRepos(page, 30);
    res.json(
      repos.map((r) => ({
        full_name: r.full_name,
        name: r.name,
        owner: r.owner?.login,
        description: r.description,
        html_url: r.html_url,
        stargazers_count: r.stargazers_count,
        default_branch: r.default_branch,
        updated_at: r.updated_at,
        private: r.private,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/repo-info", async (req, res, next) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: { code: "MISSING_URL", message: "Repository URL is required." } });
    }

    const parsed = parseRepoUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: { code: "INVALID_URL", message: "Could not parse GitHub repository URL." } });
    }

    const repo = await getRepoInfo(parsed.owner, parsed.repo);
    res.json({
      full_name: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login,
      description: repo.description,
      html_url: repo.html_url,
      stargazers_count: repo.stargazers_count,
      default_branch: repo.default_branch,
      private: repo.private,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/repos/:owner/:repo/tags", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const tags = await listTags(req.params.owner, req.params.repo, page, 30);
    res.json(
      tags.map((t) => ({
        name: t.name,
        sha: t.commit?.sha,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/repos/:owner/:repo/commits", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const commits = await listCommits(req.params.owner, req.params.repo, page, 30);
    res.json(
      commits.map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit?.message?.split("\n")[0] || "",
        date: c.commit?.committer?.date || c.commit?.author?.date || "",
        author: c.commit?.author?.name || "",
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/repos/:owner/:repo/docs-check", async (req, res, next) => {
  try {
    const ref = req.query.ref || "HEAD";
    const docs = await getDocsTree(req.params.owner, req.params.repo, ref);
    res.json({
      exists: docs.length > 0,
      fileCount: docs.filter((d) => d.type === "file" && d.name.endsWith(".md")).length,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/import", csrfMiddleware, async (req, res, next) => {
  try {
    const { repoUrl, projectName, projectSlug, visibility, refs } = req.body;

    if (!repoUrl || !projectName || !projectSlug || !refs || !Array.isArray(refs) || refs.length === 0) {
      throw new ValidationError("Missing required fields: repoUrl, projectName, projectSlug, and at least one ref.");
    }

    if (refs.length > 200) {
      throw new ValidationError("Cannot import more than 200 versions at once.");
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      throw new ValidationError("Invalid GitHub repository URL.");
    }

    const normalizedSlug = String(projectSlug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const projectInput = createProjectSchema.safeParse({
      name: projectName,
      slug: normalizedSlug,
      description: `Imported from github.com/${parsed.owner}/${parsed.repo}`,
      visibility: visibility || "private",
      mode: "versioned",
    });

    if (!projectInput.success) {
      const details = projectInput.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      }));
      throw new ValidationError("One or more fields are invalid.", details);
    }

    const project = await createProject(projectInput.data, req.user.id, req.requestId);

    const results = [];

    const orderedRefs = [...refs].reverse();

    for (const ref of orderedRefs) {
      if (!ref.sha || !ref.label) continue;

      try {
        const version = await createVersion(project.id, { label: ref.label, is_public: visibility === "public" }, req.requestId);

        const docs = await importDocsForRef(parsed.owner, parsed.repo, ref.sha);

        const parentMap = new Map();

        for (const doc of docs) {
          let parentId = "";
          if (doc.parent && parentMap.has(doc.parent)) {
            parentId = parentMap.get(doc.parent);
          }

          const page = await createPage(
            version.id,
            {
              title: doc.title,
              slug: doc.slug,
              content: doc.content,
              parent: parentId,
              icon: "",
            },
            req.requestId,
          );

          parentMap.set(doc.slug, page.id);
        }

        results.push({ label: ref.label, pageCount: docs.length, success: true });
      } catch (err) {
        logger.warn("Failed to import ref", { ref: ref.label, error: err.message });
        results.push({ label: ref.label, pageCount: 0, success: false, error: err.message });
      }
    }

    res.json({
      projectId: project.id,
      projectName: project.name,
      results,
    });

    recordAuditLog({ action: AUDIT_ACTIONS.GITHUB_IMPORT, userId: req.user.id, userEmail: req.user.email, targetType: "project", targetId: project.id, description: `Imported from GitHub: ${parsed.owner}/${parsed.repo} (${results.filter((r) => r.success).length} versions)`, ipAddress: getClientIp(req) });
  } catch (err) {
    next(err);
  }
});

export default router;
